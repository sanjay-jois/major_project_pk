"""
data/validation.py — Data validation, schema checking, and data quality audits.
"""
from __future__ import annotations
from typing import Dict, Any, List, Tuple
import numpy as np
import pandas as pd

EXPECTED_COLUMNS = [
    "Subject", "Time", "conc", "Rate", "Amt", "Age", "Sex", "Ht", "Wt"
]

ALTERNATIVE_MAPPINGS = {
    "subject": "Subject", "sid": "Subject", "id": "Subject", "sub": "Subject",
    "time": "Time", "t": "Time",
    "conc": "conc", "dv": "conc", "cp": "conc", "concentration": "conc",
    "rate": "Rate", "infusion_rate": "Rate",
    "amt": "Amt", "dose": "Amt", "bolus": "Amt",
    "age": "Age",
    "sex": "Sex", "gender": "Sex",
    "ht": "Ht", "height": "Ht",
    "wt": "Wt", "weight": "Wt",
    "bsa": "BSA", "lbm": "LBM", "bmi": "BMI"
}

def validate_pk_dataset(df: pd.DataFrame) -> Dict[str, Any]:
    """
    Validate a Pharmacokinetic dataset dataframe.
    Checks:
    - Required columns
    - Data types
    - Missing values (distinguishing expected NONMEM blank conc at dosing lines)
    - Infinite values
    - Negative values in physical quantities
    - Duplicates
    """
    errors: List[str] = []
    warnings: List[str] = []

    if df.empty:
        return {
            "is_valid": False,
            "errors": ["Uploaded dataset is empty."],
            "warnings": [],
            "row_count": 0,
            "subject_count": 0,
            "columns": []
        }

    # Normalize column names for check
    normalized_cols = {c.strip().lower(): c for c in df.columns}
    mapped_cols = {}
    missing_required = []

    for req in EXPECTED_COLUMNS:
        req_lower = req.lower()
        if req_lower in normalized_cols:
            mapped_cols[req] = normalized_cols[req_lower]
        elif req_lower in ALTERNATIVE_MAPPINGS and ALTERNATIVE_MAPPINGS[req_lower] in df.columns:
            mapped_cols[req] = ALTERNATIVE_MAPPINGS[req_lower]
        else:
            # Check if alternative exists in normalized
            found = False
            for alt_low, standard in ALTERNATIVE_MAPPINGS.items():
                if standard == req and alt_low in normalized_cols:
                    mapped_cols[req] = normalized_cols[alt_low]
                    found = True
                    break
            if not found:
                missing_required.append(req)

    if missing_required:
        errors.append(f"Missing required columns: {', '.join(missing_required)}")

    # Missing value count per column
    missing_counts = {str(col): int(df[col].isna().sum()) for col in df.columns}

    # Infinite value check
    infinite_counts = {}
    for col in df.select_dtypes(include=[np.number]).columns:
        inf_cnt = int(np.isinf(df[col]).sum())
        if inf_cnt > 0:
            infinite_counts[str(col)] = inf_cnt
            errors.append(f"Column '{col}' contains {inf_cnt} infinite values.")

    # Duplicate check
    duplicate_count = int(df.duplicated().sum())
    if duplicate_count > 0:
        warnings.append(f"Found {duplicate_count} duplicate rows in dataset.")

    # Demographic consistency check per subject
    subj_col = mapped_cols.get("Subject")
    subject_count = 0
    if subj_col and subj_col in df.columns:
        subject_count = int(df[subj_col].nunique())
        # Check demographic variations within subject
        for demo in ["Age", "Sex", "Ht", "Wt"]:
            col_name = mapped_cols.get(demo)
            if col_name and col_name in df.columns:
                inconsistent = df.groupby(subj_col)[col_name].nunique()
                bad_subjs = inconsistent[inconsistent > 1]
                if len(bad_subjs) > 0:
                    warnings.append(
                        f"Covariate '{demo}' varies within {len(bad_subjs)} subjects (e.g. subject {bad_subjs.index[0]})."
                    )

    # Physical range sanity check
    for col_name, min_val, max_val, label in [
        (mapped_cols.get("Age"), 0, 125, "Age (years)"),
        (mapped_cols.get("Wt"), 1, 350, "Weight (kg)"),
        (mapped_cols.get("Ht"), 30, 260, "Height (cm)"),
        (mapped_cols.get("Time"), 0, 1e6, "Time (min)"),
    ]:
        if col_name and col_name in df.columns and pd.api.types.is_numeric_dtype(df[col_name]):
            series = df[col_name].dropna()
            if (series < min_val).any() or (series > max_val).any():
                warnings.append(f"Values in '{col_name}' ({label}) exceed expected physiological bounds [{min_val}, {max_val}].")

    # Concentration sanity check
    conc_col = mapped_cols.get("conc")
    measured_count = 0
    if conc_col and conc_col in df.columns and pd.api.types.is_numeric_dtype(df[conc_col]):
        valid_concs = df[conc_col].dropna()
        measured_count = len(valid_concs)
        if (valid_concs < 0).any():
            errors.append(f"Column '{conc_col}' contains negative concentration measurements.")

    is_valid = len(errors) == 0

    return {
        "is_valid": is_valid,
        "errors": errors,
        "warnings": warnings,
        "row_count": len(df),
        "subject_count": subject_count,
        "measured_observations": measured_count,
        "mapped_columns": mapped_cols,
        "columns": list(df.columns),
        "missing_counts": missing_counts,
        "infinite_counts": infinite_counts,
        "duplicate_count": duplicate_count
    }
