"""
pharmacokinetics/dosing_history.py — Reconstruction of dosing regimens and dynamic PK covariates.
"""
from __future__ import annotations
from typing import List, Tuple, Dict, Any
import numpy as np
import pandas as pd

def extract_subject_regimen(subject_df: pd.DataFrame) -> Dict[str, Any]:
    """
    Extract infusion segments and boluses for a single subject from NONMEM-style PK data.
    """
    df = subject_df.sort_values("Time").reset_index(drop=True)
    infusions = []
    boluses = []

    # Check for Rate and Amt columns
    rate_col = "Rate" if "Rate" in df.columns else ("RATE" if "RATE" in df.columns else None)
    amt_col = "Amt" if "Amt" in df.columns else ("AMT" if "AMT" in df.columns else None)
    time_col = "Time" if "Time" in df.columns else ("TIME" if "TIME" in df.columns else None)

    if not rate_col or not time_col:
        return {"infusions": [], "boluses": []}

    n = len(df)
    for i in range(n - 1):
        r = float(df[rate_col].iloc[i]) if pd.notna(df[rate_col].iloc[i]) else 0.0
        t_start = float(df[time_col].iloc[i])
        t_next = float(df[time_col].iloc[i + 1])
        if r > 0 and t_next > t_start:
            infusions.append({"start": t_start, "end": t_next, "rate": r})

    # Consolidate continuous infusions with identical rate
    merged_infusions = []
    for inf in infusions:
        if merged_infusions and abs(merged_infusions[-1]["rate"] - inf["rate"]) < 1e-4 and abs(merged_infusions[-1]["end"] - inf["start"]) < 1e-4:
            merged_infusions[-1]["end"] = inf["end"]
        else:
            merged_infusions.append(dict(inf))

    # Check for instantaneous boluses (Amt > 0 and Rate == 0)
    if amt_col:
        for i in range(n):
            amt = float(df[amt_col].iloc[i]) if pd.notna(df[amt_col].iloc[i]) else 0.0
            r = float(df[rate_col].iloc[i]) if pd.notna(df[rate_col].iloc[i]) else 0.0
            if amt > 0 and r == 0:
                t = float(df[time_col].iloc[i])
                boluses.append({"time": t, "amt": amt})

    return {"infusions": merged_infusions, "boluses": boluses}

def compute_dynamic_features(
    times: np.ndarray,
    infusions: List[Dict[str, float]],
    boluses: List[Dict[str, float]],
    weight_kg: float
) -> Dict[str, np.ndarray]:
    """
    Compute dynamic dosing features at specified timepoints:
    RATE, Rate_per_Kg, Cum_Dose, is_infusion, time_post_inf
    """
    times = np.asarray(times, dtype=np.float64)
    n = len(times)

    rates = np.zeros(n, dtype=np.float64)
    cum_dose = np.zeros(n, dtype=np.float64)
    is_infusion = np.zeros(n, dtype=np.float64)
    time_post_inf = np.zeros(n, dtype=np.float64)

    # Pre-parse intervals
    intervals = []
    inf_end_max = 0.0
    for inf in infusions:
        s, e, r = float(inf["start"]), float(inf["end"]), float(inf["rate"])
        if e > s and r > 0:
            intervals.append((s, e, r))
            if e > inf_end_max:
                inf_end_max = e

    norm_boluses = [(float(b["time"]), float(b["amt"])) for b in boluses if float(b["amt"]) > 0]

    for idx, t in enumerate(times):
        r_current = 0.0
        dose = 0.0

        # Accumulate infusion dose up to t
        for s, e, r in intervals:
            if s <= t < e:
                r_current += r
            if t > s:
                duration_in_interval = min(t, e) - s
                dose += r * duration_in_interval

        # Accumulate bolus dose up to t
        for b_time, amt in norm_boluses:
            if t >= b_time:
                dose += amt

        rates[idx] = r_current
        cum_dose[idx] = dose
        is_infusion[idx] = 1.0 if r_current > 0 else 0.0
        time_post_inf[idx] = max(0.0, t - inf_end_max) if t > inf_end_max else 0.0

    rate_per_kg = rates / max(1.0, weight_kg)

    return {
        "RATE": rates,
        "Rate_per_Kg": rate_per_kg,
        "Cum_Dose": cum_dose,
        "is_infusion": is_infusion,
        "time_post_inf": time_post_inf
    }
