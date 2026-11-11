"""
services/dataset_service.py — Dataset management, caching, and summary operations.
"""
from __future__ import annotations
from typing import Dict, Any, List, Optional
from pathlib import Path
import io
import pandas as pd
import numpy as np

from ..core.config import DEFAULT_DATASET, LLOQ
from ..data.validation import validate_pk_dataset
from ..data.preprocessing import clean_and_normalize_pk_data, build_greybox_dataset
from ..pharmacokinetics.dosing_history import extract_subject_regimen

class DatasetService:
    def __init__(self, default_path: Optional[Path] = None):
        self.dataset_path = default_path or DEFAULT_DATASET
        self._raw_df: Optional[pd.DataFrame] = None
        self._clean_df: Optional[pd.DataFrame] = None
        self._greybox_df: Optional[pd.DataFrame] = None
        self._load_initial_dataset()

    def _load_initial_dataset(self):
        if self.dataset_path and self.dataset_path.exists():
            try:
                raw = pd.read_csv(self.dataset_path)
                self.load_dataframe(raw)
            except Exception as e:
                print(f"[DatasetService] Warning loading initial dataset: {e}")

    def load_dataframe(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Validate and set active dataset."""
        val_report = validate_pk_dataset(df)
        if not val_report["is_valid"]:
            return val_report

        self._raw_df = df
        self._clean_df = clean_and_normalize_pk_data(df)
        # Invalidate greybox cache
        self._greybox_df = None
        return val_report

    def load_csv_bytes(self, content: bytes) -> Dict[str, Any]:
        """Load dataset from uploaded CSV bytes."""
        try:
            df = pd.read_csv(io.BytesIO(content))
        except Exception as e:
            return {
                "is_valid": False,
                "errors": [f"CSV parsing error: {str(e)}"],
                "warnings": []
            }
        return self.load_dataframe(df)

    def get_raw_dataframe(self) -> pd.DataFrame:
        if self._raw_df is None:
            self._load_initial_dataset()
        return self._raw_df if self._raw_df is not None else pd.DataFrame()

    def get_clean_dataframe(self) -> pd.DataFrame:
        if self._clean_df is None:
            raw = self.get_raw_dataframe()
            if not raw.empty:
                self._clean_df = clean_and_normalize_pk_data(raw)
            else:
                return pd.DataFrame()
        return self._clean_df

    def get_greybox_dataframe(self) -> pd.DataFrame:
        if self._greybox_df is None:
            clean = self.get_clean_dataframe()
            if not clean.empty:
                self._greybox_df = build_greybox_dataset(clean)
            else:
                return pd.DataFrame()
        return self._greybox_df

    def get_summary(self) -> Dict[str, Any]:
        """Compute comprehensive dataset statistics."""
        df = self.get_clean_dataframe()
        if df.empty:
            return {
                "total_rows": 0, "total_subjects": 0, "drug": "Remifentanil",
                "columns": [], "missing_values": {}, "infinite_values": {},
                "duplicates_count": 0, "numeric_stats": {}, "demographics": {},
                "lloq": LLOQ
            }

        numeric_stats = {}
        for col in df.select_dtypes(include=[np.number]).columns:
            series = df[col].dropna()
            if len(series) > 0:
                numeric_stats[col] = {
                    "count": float(len(series)),
                    "mean": round(float(series.mean()), 3),
                    "std": round(float(series.std()), 3) if len(series) > 1 else 0.0,
                    "min": round(float(series.min()), 3),
                    "p25": round(float(series.quantile(0.25)), 3),
                    "median": round(float(series.median()), 3),
                    "p75": round(float(series.quantile(0.75)), 3),
                    "max": round(float(series.max()), 3)
                }

        # Demographic summary across unique subjects
        subj_group = df.groupby("Subject").first().reset_index()
        demographics = {
            "total_subjects": int(len(subj_group)),
            "age_mean": round(float(subj_group["Age"].mean()), 1) if "Age" in subj_group else None,
            "age_range": [round(float(subj_group["Age"].min()), 1), round(float(subj_group["Age"].max()), 1)] if "Age" in subj_group else None,
            "weight_mean": round(float(subj_group["Wt"].mean()), 1) if "Wt" in subj_group else None,
            "height_mean": round(float(subj_group["Ht"].mean()), 1) if "Ht" in subj_group else None,
            "male_count": int((subj_group["Sex"].str.lower() == "male").sum()) if "Sex" in subj_group else None,
            "female_count": int((subj_group["Sex"].str.lower() == "female").sum()) if "Sex" in subj_group else None
        }

        # Missing & Infinite counts
        missing_dict = {col: int(df[col].isna().sum()) for col in df.columns}
        inf_dict = {col: int(np.isinf(df[col]).sum()) for col in df.select_dtypes(include=[np.number]).columns}

        return {
            "total_rows": len(df),
            "total_subjects": int(df["Subject"].nunique()) if "Subject" in df else 0,
            "drug": "Remifentanil",
            "columns": list(df.columns),
            "missing_values": missing_dict,
            "infinite_values": inf_dict,
            "duplicates_count": int(df.duplicated().sum()),
            "numeric_stats": numeric_stats,
            "demographics": demographics,
            "lloq": LLOQ
        }

    def get_preview(self, page: int = 1, page_size: int = 50, subject_id: Optional[int] = None) -> Dict[str, Any]:
        """Paginated preview with optional subject filter."""
        df = self.get_clean_dataframe()
        if df.empty:
            return {"total_rows": 0, "page": page, "page_size": page_size, "columns": [], "rows": []}

        if subject_id is not None:
            df = df[df["Subject"] == subject_id]

        total_rows = len(df)
        start_idx = max(0, (page - 1) * page_size)
        end_idx = min(total_rows, start_idx + page_size)

        subset = df.iloc[start_idx:end_idx].copy()
        # Clean NaNs for JSON serialization
        records = subset.replace({np.nan: None}).to_dict(orient="records")

        return {
            "total_rows": total_rows,
            "page": page,
            "page_size": page_size,
            "columns": list(df.columns),
            "rows": records
        }

    def get_subject_profile(self, subject_id: int) -> Optional[Dict[str, Any]]:
        """Get demographics, dosing history, and measured observations for a subject."""
        df = self.get_clean_dataframe()
        if df.empty or "Subject" not in df:
            return None

        sub_df = df[df["Subject"] == subject_id].sort_values("Time").reset_index(drop=True)
        if sub_df.empty:
            return None

        first = sub_df.iloc[0]
        regimen = extract_subject_regimen(sub_df)

        obs = []
        for _, row in sub_df.iterrows():
            if pd.notna(row.get("conc")) and float(row["conc"]) > 0:
                obs.append({
                    "time": round(float(row["Time"]), 2),
                    "conc": round(float(row["conc"]), 3)
                })

        return {
            "subject_id": subject_id,
            "patient": {
                "age": float(first.get("Age", 40.0)),
                "weight": float(first.get("Wt", 70.0)),
                "height": float(first.get("Ht", 170.0)),
                "sex": str(first.get("Sex", "Male"))
            },
            "regimen": regimen,
            "observations": obs,
            "max_time": float(sub_df["Time"].max())
        }

    def get_subjects_list(self) -> List[Dict[str, Any]]:
        """List all subjects with demographic summary."""
        df = self.get_clean_dataframe()
        if df.empty or "Subject" not in df:
            return []

        grouped = df.groupby("Subject").first().reset_index()
        subjects = []
        for _, row in grouped.iterrows():
            sid = int(row["Subject"])
            obs_cnt = int(df[(df["Subject"] == sid) & df["conc"].notna()]["conc"].count())
            subjects.append({
                "subject_id": sid,
                "age": float(row.get("Age", 0)),
                "weight": float(row.get("Wt", 0)),
                "height": float(row.get("Ht", 0)),
                "sex": str(row.get("Sex", "Male")),
                "observations_count": obs_cnt
            })
        return subjects

    def export_clean_csv(self) -> str:
        """Export cleaned dataset as CSV string."""
        df = self.get_clean_dataframe()
        return df.to_csv(index=False)

# Singleton instance
dataset_service = DatasetService()
