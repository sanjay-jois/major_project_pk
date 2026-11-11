"""
ml/train.py — Subject-wise Training Pipeline with Split-Conformal Calibration.
"""
from __future__ import annotations
from typing import Dict, Any, List, Optional
import time
import json
from pathlib import Path
import numpy as np
import pandas as pd
import joblib

from sklearn.model_selection import GroupShuffleSplit
from sklearn.preprocessing import StandardScaler

from ..core.config import ARTIFACTS_DIR, LLOQ
from ..pharmacokinetics.greybox import GREYBOX_FEATURES, compute_residuals, reconstruct_concentration
from ..pharmacokinetics.conformal import calibrate_split_conformal, evaluate_conformal_coverage
from .metrics import calculate_pk_metrics
from .models import get_model_instances, MODEL_DESCRIPTIONS

def train_and_evaluate_all(
    greybox_df: pd.DataFrame,
    selected_models: Optional[List[str]] = None,
    test_size: float = 0.2,
    random_state: int = 42
) -> Dict[str, Any]:
    """
    Train models on subject-wise partitions:
    - Train (60%): Model fitting on log-residuals
    - Calibration (20%): Split-conformal calibration
    - Test (20%): Final evaluation of prediction intervals and metrics
    """
    df = greybox_df.copy()
    if len(df) < 20 or df["Subject"].nunique() < 3:
        raise ValueError("Insufficient data or subjects for cross-subject training.")

    X_all = df[GREYBOX_FEATURES].values.astype(np.float64)
    y_true_all = df["conc"].values.astype(np.float64)
    cp_minto_all = df["Cp_minto"].values.astype(np.float64)
    r_all = compute_residuals(y_true_all, cp_minto_all)
    groups = df["Subject"].values

    # Step 1: Split into (Train+Calib) and Test by Subject
    gss1 = GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=random_state)
    tr_cal_idx, te_idx = next(gss1.split(X_all, r_all, groups))

    # Step 2: Split (Train+Calib) into Train and Calibration by Subject
    tr_cal_groups = groups[tr_cal_idx]
    cal_ratio = 0.25  # 25% of 80% = 20% total calibration
    gss2 = GroupShuffleSplit(n_splits=1, test_size=cal_ratio, random_state=random_state + 1)
    sub_tr_idx, sub_cal_idx = next(gss2.split(tr_cal_idx, r_all[tr_cal_idx], tr_cal_groups))

    train_idx = tr_cal_idx[sub_tr_idx]
    cal_idx = tr_cal_idx[sub_cal_idx]

    # Preprocessing: StandardScaler fitted ONLY on training split
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_all[train_idx])
    X_cal = scaler.transform(X_all[cal_idx])
    X_test = scaler.transform(X_all[te_idx])

    r_train = r_all[train_idx]
    y_test = y_true_all[te_idx]
    cp_minto_test = cp_minto_all[te_idx]
    y_cal = y_true_all[cal_idx]
    cp_minto_cal = cp_minto_all[cal_idx]

    # Save scaler and feature names
    joblib.dump(scaler, ARTIFACTS_DIR / "scaler.joblib")
    joblib.dump(GREYBOX_FEATURES, ARTIFACTS_DIR / "feature_names.joblib")

    # Minto Baseline Evaluation on Test Set
    minto_metrics = calculate_pk_metrics(y_test, cp_minto_test)
    minto_record = {
        "model": "Minto",
        **minto_metrics,
        "coverage_95": None,
        "mean_interval_width": None,
        "training_time_sec": 0.0,
        "is_baseline": True,
        "description": MODEL_DESCRIPTIONS.get("Minto")
    }

    leaderboard = [minto_record]
    trained_artifacts = {}
    conformal_qs = {}
    val_data = {}

    all_models = get_model_instances(random_state)
    models_to_run = selected_models if selected_models else list(all_models.keys())

    # Damping parameters for residual reconstruction
    damping_factors = {
        "BayesianCompartment": 0.8,
        "SupportVectorRobust": 0.8,
        "RandomForest": 0.65,
        "ExtraTrees": 0.65,
        "GradientBoosting": 0.7,
        "XGBoost": 0.65,
        "CatBoost": 0.7,
        "StackingEnsemble": 0.65
    }

    for name in models_to_run:
        if name not in all_models:
            continue
        model = all_models[name]
        damp = damping_factors.get(name, 0.7)

        t0 = time.time()
        model.fit(X_train, r_train)
        train_time = round(time.time() - t0, 3)

        # 1. Predictions on Calibration Set
        r_pred_cal = model.predict(X_cal)
        y_pred_cal = reconstruct_concentration(cp_minto_cal, r_pred_cal, damping=damp)

        # 2. Conformal Calibration (q_score)
        q_score = calibrate_split_conformal(y_cal, y_pred_cal, alpha=0.05, lloq=LLOQ)
        conformal_qs[name] = q_score

        # 3. Predictions on Held-Out Test Set
        r_pred_test = model.predict(X_test)
        y_pred_test = reconstruct_concentration(cp_minto_test, r_pred_test, damping=damp)

        # 4. Metrics
        metrics = calculate_pk_metrics(y_test, y_pred_test)
        conf_eval = evaluate_conformal_coverage(y_test, y_pred_test, q_score, lloq=LLOQ)

        # Save model artifact
        joblib.dump(model, ARTIFACTS_DIR / f"{name}.joblib")
        trained_artifacts[name] = {
            "damping": damp,
            "q_score": q_score
        }

        # Store test validation points for plotting
        val_data[name] = {
            "observed": y_test.tolist(),
            "predicted": y_pred_test.tolist(),
            "residuals": (y_test - y_pred_test).tolist(),
            "times": df["Time"].values[te_idx].tolist(),
            "is_infusion": [bool(x > 0) for x in df["is_infusion"].values[te_idx]],
            "subjects": [int(s) for s in df["Subject"].values[te_idx]],
            "conformal_q95": q_score,
            "empirical_coverage": conf_eval["empirical_coverage_pct"]
        }

        record = {
            "model": name,
            **metrics,
            "coverage_95": conf_eval["empirical_coverage_pct"],
            "mean_interval_width": conf_eval["mean_interval_width"],
            "training_time_sec": train_time,
            "is_baseline": False,
            "description": MODEL_DESCRIPTIONS.get(name)
        }
        leaderboard.append(record)

    # Save metadata and leaderboard
    joblib.dump(trained_artifacts, ARTIFACTS_DIR / "trained_artifacts.joblib")
    with open(ARTIFACTS_DIR / "leaderboard.json", "w") as f:
        json.dump(leaderboard, f, indent=2)
    with open(ARTIFACTS_DIR / "validation_data.json", "w") as f:
        json.dump(val_data, f, indent=2)

    # Sort leaderboard by MAE (ascending)
    leaderboard_sorted = sorted(leaderboard, key=lambda x: x["MAE"])
    best_model = next((m["model"] for m in leaderboard_sorted if not m.get("is_baseline")), "XGBoost")

    return {
        "leaderboard": leaderboard_sorted,
        "default_model": best_model,
        "validation_data": val_data,
        "conformal_quantiles": conformal_qs
    }
