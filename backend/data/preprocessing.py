"""
data/preprocessing.py — PK Data Cleaning, Normalization, and Dataset Builder.
"""
from __future__ import annotations
from typing import Tuple, Dict, Any, Optional
from pathlib import Path
import numpy as np
import pandas as pd

from ..pharmacokinetics.mechanistic_model import simulate_ode, lbm_james, calculate_bmi, calculate_bsa
from ..pharmacokinetics.greybox import GREYBOX_FEATURES
from ..pharmacokinetics.dosing_history import extract_subject_regimen

def clean_and_normalize_pk_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    Standardize column names to canonical schema:
    Subject, Time, conc, Rate, Amt, Age, Sex, Ht, Wt, BMI, LBM, BSA
    """
    clean_df = df.copy()

    # Normalize column names while preventing duplicates
    col_map = {}
    cols_lower = [c.strip().lower() for c in clean_df.columns]
    has_subject = any(c in ("subject", "sid") for c in cols_lower)
    has_conc = any(c == "conc" for c in cols_lower)
    has_time = any(c == "time" for c in cols_lower)
    has_rate = any(c == "rate" for c in cols_lower)
    has_amt = any(c == "amt" for c in cols_lower)

    for col in clean_df.columns:
        c_low = col.strip().lower()
        if c_low in ("subject", "sid"):
            col_map[col] = "Subject"
        elif c_low in ("id", "sub") and not has_subject and "Subject" not in col_map.values():
            col_map[col] = "Subject"
        elif c_low == "time":
            col_map[col] = "Time"
        elif c_low == "t" and not has_time and "Time" not in col_map.values():
            col_map[col] = "Time"
        elif c_low == "conc":
            col_map[col] = "conc"
        elif c_low in ("dv", "cp", "concentration") and not has_conc and "conc" not in col_map.values():
            col_map[col] = "conc"
        elif c_low == "rate":
            col_map[col] = "Rate"
        elif c_low == "infusion_rate" and not has_rate and "Rate" not in col_map.values():
            col_map[col] = "Rate"
        elif c_low == "amt":
            col_map[col] = "Amt"
        elif c_low in ("dose", "bolus") and not has_amt and "Amt" not in col_map.values():
            col_map[col] = "Amt"
        elif c_low == "age":
            col_map[col] = "Age"
        elif c_low in ("sex", "gender") and "Sex" not in col_map.values():
            col_map[col] = "Sex"
        elif c_low in ("ht", "height") and "Ht" not in col_map.values():
            col_map[col] = "Ht"
        elif c_low in ("wt", "weight") and "Wt" not in col_map.values():
            col_map[col] = "Wt"
        elif c_low == "bmi":
            col_map[col] = "BMI"
        elif c_low == "lbm":
            col_map[col] = "LBM"
        elif c_low == "bsa":
            col_map[col] = "BSA"

    clean_df.rename(columns=col_map, inplace=True)

    # Convert numeric fields
    numeric_cols = ["Time", "conc", "Rate", "Amt", "Age", "Ht", "Wt"]
    for c in numeric_cols:
        if c in clean_df.columns:
            clean_df[c] = pd.to_numeric(clean_df[c], errors="coerce")

    # Standardize Sex to Male / Female
    if "Sex" in clean_df.columns:
        def norm_sex(v):
            v_str = str(v).strip().lower()
            if v_str in ("male", "m", "1", "1.0"):
                return "Male"
            return "Female"
        clean_df["Sex"] = clean_df["Sex"].apply(norm_sex)

    # Compute missing BMI, LBM, BSA if needed
    for idx, row in clean_df.iterrows():
        ht, wt, sex = row.get("Ht"), row.get("Wt"), row.get("Sex")
        if pd.notna(ht) and pd.notna(wt):
            if "BMI" not in clean_df.columns or pd.isna(clean_df.at[idx, "BMI"]):
                clean_df.at[idx, "BMI"] = calculate_bmi(float(ht), float(wt))
            if "BSA" not in clean_df.columns or pd.isna(clean_df.at[idx, "BSA"]):
                clean_df.at[idx, "BSA"] = calculate_bsa(float(ht), float(wt))
            if "LBM" not in clean_df.columns or pd.isna(clean_df.at[idx, "LBM"]):
                clean_df.at[idx, "LBM"] = lbm_james(float(wt), float(ht), sex)

    # Fill defaults for Rate and Amt where blank
    if "Rate" in clean_df.columns:
        clean_df["Rate"] = clean_df["Rate"].fillna(0.0)
    if "Amt" in clean_df.columns:
        clean_df["Amt"] = clean_df["Amt"].fillna(0.0)

    # Sort deterministically
    sort_cols = [c for c in ["Subject", "Time"] if c in clean_df.columns]
    if sort_cols:
        clean_df.sort_values(by=sort_cols, inplace=True)

    return clean_df.reset_index(drop=True)

def build_greybox_dataset(df: pd.DataFrame, dt: float = 0.05) -> pd.DataFrame:
    """
    Build the full grey-box feature dataset by integrating the Minto ODE per subject.
    Only rows with valid measured concentrations (conc > 0) are kept for ML training.
    """
    clean_df = clean_and_normalize_pk_data(df)
    rows = []

    for sid, group in clean_df.groupby("Subject"):
        group = group.sort_values("Time").reset_index(drop=True)
        if group.empty:
            continue

        age = float(group["Age"].iloc[0])
        wt = float(group["Wt"].iloc[0])
        ht = float(group["Ht"].iloc[0])
        sex_str = str(group["Sex"].iloc[0])
        sex_num = 1 if sex_str.lower() in ("male", "m", "1") else 0

        patient_dict = {"age": age, "weight": wt, "height": ht, "sex": sex_str}
        regimen = extract_subject_regimen(group)

        # Dynamic simulation
        t_max = float(group["Time"].max())
        for inf in regimen["infusions"]:
            if inf["end"] > t_max:
                t_max = inf["end"]

        sim = simulate_ode(patient_dict, regimen["infusions"], regimen["boluses"],
                           duration_min=t_max + 5.0, dt=dt)
        sim_t = np.array(sim["time"])
        sim_Cp = np.array(sim["Cp"])
        sim_Ce = np.array(sim["Ce"])
        sim_A2 = np.array(sim["A2"])
        sim_A3 = np.array(sim["A3"])
        V2 = sim["parameters"]["V2"]
        V3 = sim["parameters"]["V3"]
        sim_C2 = sim_A2 / max(0.1, V2)
        sim_C3 = sim_A3 / max(0.1, V3)

        # Query times
        q_times = group["Time"].values.astype(float)
        Cp_interp = np.interp(q_times, sim_t, sim_Cp)
        Ce_interp = np.interp(q_times, sim_t, sim_Ce)
        C2_interp = np.interp(q_times, sim_t, sim_C2)
        C3_interp = np.interp(q_times, sim_t, sim_C3)

        # Reconstruct dosing metrics
        cum_dose = group["Amt"].cumsum().values
        inf_end = max((inf["end"] for inf in regimen["infusions"]), default=0.0)

        bmi = float(group["BMI"].iloc[0]) if "BMI" in group.columns else calculate_bmi(ht, wt)
        lbm = float(group["LBM"].iloc[0]) if "LBM" in group.columns else lbm_james(wt, ht, sex_num)
        bsa = float(group["BSA"].iloc[0]) if "BSA" in group.columns else calculate_bsa(ht, wt)

        for i in range(len(group)):
            conc_val = group["conc"].iloc[i]
            # Skip observation if conc is NaN or missing (e.g. dosing marker rows)
            if pd.isna(conc_val) or conc_val is None:
                continue

            t_val = float(q_times[i])
            rate_val = float(group["Rate"].iloc[i]) if pd.notna(group["Rate"].iloc[i]) else 0.0

            rows.append({
                "Subject": sid,
                "Time": t_val,
                "conc": float(conc_val),
                "Cp_minto": float(Cp_interp[i]),
                "Ce_minto": float(Ce_interp[i]),
                "C2_minto": float(C2_interp[i]),
                "C3_minto": float(C3_interp[i]),
                "logCp_minto": float(np.log(max(Cp_interp[i], 1e-3))),
                "AGE": age,
                "WGHT": wt,
                "HGHT": ht,
                "SEX": sex_num,
                "BMI": bmi,
                "LBM": lbm,
                "BSA": bsa,
                "RATE": rate_val,
                "Rate_per_Kg": rate_val / max(1.0, wt),
                "Cum_Dose": float(cum_dose[i]),
                "is_infusion": 1.0 if rate_val > 0 else 0.0,
                "time_post_inf": max(0.0, t_val - inf_end) if t_val > inf_end else 0.0
            })

    return pd.DataFrame(rows)
