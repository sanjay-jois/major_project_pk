"""
ml/metrics.py — Statistical and Clinical Regression Metrics for Pharmacokinetic Models.

Reference:
    Varvel JR, Donoho DL, Shafer SL. "Measuring the predictive performance of
    computer-controlled infusion pumps." J Pharmacokinet Biopharm 1992; 20:63-94.
"""
from __future__ import annotations
from typing import Dict, Any
import numpy as np
from ..core.config import LLOQ

def calculate_pk_metrics(y_true: np.ndarray, y_pred: np.ndarray, lloq: float = LLOQ) -> Dict[str, float]:
    """
    Compute comprehensive clinical and statistical regression metrics.
    Handles zero and near-zero concentrations safely using LLOQ.
    """
    y = np.asarray(y_true, dtype=np.float64)
    p = np.asarray(y_pred, dtype=np.float64)

    # Standard residuals
    residuals = y - p
    abs_residuals = np.abs(residuals)

    mae = float(np.mean(abs_residuals))
    rmse = float(np.sqrt(np.mean(residuals ** 2)))

    # R-squared (coefficient of determination)
    total_ss = np.sum((y - np.mean(y)) ** 2)
    residual_ss = np.sum(residuals ** 2)
    r2 = float(1.0 - (residual_ss / total_ss)) if total_ss > 1e-9 else 0.0

    # Varvel Clinical TCI Metrics: PE = 100 * (observed - predicted) / predicted
    # Evaluated on concentrations above LLOQ to avoid division by zero/near-zero
    valid_mask = (y > lloq) & (p > lloq)
    if valid_mask.sum() > 0:
        pe = 100.0 * (y[valid_mask] - p[valid_mask]) / p[valid_mask]
        mdpe = float(np.median(pe))
        mdape = float(np.median(np.abs(pe)))
    else:
        mdpe = 0.0
        mdape = 0.0

    # Weighted Absolute Percentage Error (WAPE)
    sum_y = np.sum(np.abs(y))
    wape = float(100.0 * np.sum(abs_residuals) / sum_y) if sum_y > 1e-9 else 0.0

    # Accuracy within ±10%, ±20%, ±30%
    if valid_mask.sum() > 0:
        ratio = p[valid_mask] / y[valid_mask]
        acc_10 = float(np.mean((ratio >= 0.90) & (ratio <= 1.10)) * 100.0)
        acc_20 = float(np.mean((ratio >= 0.80) & (ratio <= 1.20)) * 100.0)
        acc_30 = float(np.mean((ratio >= 0.70) & (ratio <= 1.30)) * 100.0)
    else:
        acc_10 = 0.0
        acc_20 = 0.0
        acc_30 = 0.0

    return {
        "MAE": round(mae, 3),
        "RMSE": round(rmse, 3),
        "R2": round(r2, 4),
        "MDPE": round(mdpe, 2),
        "MDAPE": round(mdape, 2),
        "WAPE": round(wape, 2),
        "accuracy_10": round(acc_10, 1),
        "accuracy_20": round(acc_20, 1),
        "accuracy_30": round(acc_30, 1)
    }
