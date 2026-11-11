"""
pharmacokinetics/greybox.py — Grey-Box Mechanistic + Machine Learning Integration.
"""
from __future__ import annotations
from typing import Dict, Any, List, Tuple
import numpy as np
import pandas as pd

from .mechanistic_model import simulate_ode, lbm_james, calculate_bmi, calculate_bsa
from .dosing_history import compute_dynamic_features

GREYBOX_FEATURES = [
    "Cp_minto", "Ce_minto", "C2_minto", "C3_minto", "logCp_minto",
    "AGE", "WGHT", "HGHT", "SEX", "BMI", "LBM", "BSA",
    "RATE", "Rate_per_Kg", "Cum_Dose", "is_infusion", "time_post_inf"
]

def build_greybox_features_for_times(
    patient: Dict[str, Any],
    infusions: List[Dict[str, float]],
    boluses: List[Dict[str, float]],
    times: np.ndarray,
    dt: float = 0.05
) -> Tuple[np.ndarray, Dict[str, np.ndarray], Dict[str, Any]]:
    """
    Run ODE simulation and compute the 17 grey-box features at specified times.
    Returns:
        X: (N, 17) feature matrix
        mechanistic_states: dict of {"Cp", "Ce", "C2", "C3"}
        ode_params: dict of Minto parameters
    """
    age = float(patient.get("age", 40.0))
    wt = float(patient.get("weight", 70.0))
    ht = float(patient.get("height", 170.0))
    sex_str = str(patient.get("sex", "Male")).lower()
    sex_numeric = 1 if (sex_str in ("male", "m", "1")) else 0

    lbm = lbm_james(wt, ht, sex_numeric)
    bmi = calculate_bmi(ht, wt)
    bsa = calculate_bsa(ht, wt)

    tmax = float(np.max(times)) if len(times) > 0 else 90.0
    for inf in infusions:
        if float(inf.get("end", 0.0)) > tmax:
            tmax = float(inf["end"])

    sim_res = simulate_ode(patient, infusions, boluses, duration_min=tmax + 5.0, dt=dt)
    sim_t = np.array(sim_res["time"])
    sim_Cp = np.array(sim_res["Cp"])
    sim_Ce = np.array(sim_res["Ce"])
    sim_A2 = np.array(sim_res["A2"])
    sim_A3 = np.array(sim_res["A3"])
    V2 = sim_res["parameters"]["V2"]
    V3 = sim_res["parameters"]["V3"]
    sim_C2 = sim_A2 / max(0.1, V2)
    sim_C3 = sim_A3 / max(0.1, V3)

    # Interpolate ODE states at exact query times
    Cp_interp = np.interp(times, sim_t, sim_Cp)
    Ce_interp = np.interp(times, sim_t, sim_Ce)
    C2_interp = np.interp(times, sim_t, sim_C2)
    C3_interp = np.interp(times, sim_t, sim_C3)
    logCp_interp = np.log(np.maximum(Cp_interp, 1e-3))

    dyn = compute_dynamic_features(times, infusions, boluses, wt)

    n = len(times)
    feat_dict = {
        "Cp_minto": Cp_interp,
        "Ce_minto": Ce_interp,
        "C2_minto": C2_interp,
        "C3_minto": C3_interp,
        "logCp_minto": logCp_interp,
        "AGE": np.full(n, age),
        "WGHT": np.full(n, wt),
        "HGHT": np.full(n, ht),
        "SEX": np.full(n, float(sex_numeric)),
        "BMI": np.full(n, bmi),
        "LBM": np.full(n, lbm),
        "BSA": np.full(n, bsa),
        "RATE": dyn["RATE"],
        "Rate_per_Kg": dyn["Rate_per_Kg"],
        "Cum_Dose": dyn["Cum_Dose"],
        "is_infusion": dyn["is_infusion"],
        "time_post_inf": dyn["time_post_inf"]
    }

    X = np.column_stack([feat_dict[col] for col in GREYBOX_FEATURES])
    states = {
        "Cp": Cp_interp,
        "Ce": Ce_interp,
        "C2": C2_interp,
        "C3": C3_interp
    }
    return X, states, sim_res["parameters"]

def compute_residuals(y_true: np.ndarray, cp_minto: np.ndarray) -> np.ndarray:
    """Multiplicative log-residual: r = ln(y_true) - ln(cp_minto)"""
    y_safe = np.maximum(y_true, 1e-3)
    cp_safe = np.maximum(cp_minto, 1e-3)
    return np.log(y_safe) - np.log(cp_safe)

def reconstruct_concentration(cp_minto: np.ndarray, r_pred: np.ndarray, damping: float = 0.7) -> np.ndarray:
    """
    Invert log-residuals with damping: Cp_hat = Cp_minto * exp(damping * r_pred)
    Preserves strict physical decay and positivity.
    """
    cp_safe = np.maximum(cp_minto, 1e-3)
    r_clipped = np.clip(r_pred, -4.0, 4.0)
    return np.maximum(1e-3, cp_safe * np.exp(damping * r_clipped))
