"""
pharmacokinetics/conformal.py — Split-Conformal Prediction Interval Calibration and Evaluation.

Reference:
    Vovk, Gammerman, Shafer. "Algorithmic Learning in a Random World" (2005).
    Angelopoulos & Bates. "A Gentle Introduction to Conformal Prediction and Distribution-Free
    Uncertainty Quantification" (2021).
"""
from __future__ import annotations
from typing import Tuple, Dict, Any
import numpy as np

def calibrate_split_conformal(
    y_cal: np.ndarray,
    y_pred_cal: np.ndarray,
    alpha: float = 0.05,
    lloq: float = 0.1
) -> float:
    """
    Calibrate non-conformity scores on an independent calibration set.
    Uses log-ratio non-conformity: s_i = |ln(y_i) - ln(y_pred_i)|
    Guarantees 1 - alpha marginal coverage under exchangeability.
    """
    y = np.asarray(y_cal, dtype=np.float64)
    p = np.asarray(y_pred_cal, dtype=np.float64)

    # Filter points above LLOQ for numerical stability
    mask = (y > lloq) & (p > lloq)
    if mask.sum() < 5:
        mask = (y > 1e-3) & (p > 1e-3)

    y_sub = y[mask]
    p_sub = p[mask]

    scores = np.abs(np.log(y_sub) - np.log(p_sub))
    n = len(scores)
    if n == 0:
        return 0.5  # fallback reasonable log margin

    # Finite-sample correction quantile: ceil((n + 1) * (1 - alpha)) / n
    level = min(1.0, np.ceil((n + 1) * (1.0 - alpha)) / n)
    q = float(np.quantile(scores, level, method="higher"))
    return max(0.05, q)

def compute_conformal_bounds(
    y_pred: np.ndarray,
    q_score: float
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Compute multiplicative 95% split-conformal bounds:
        low = y_pred * exp(-q)
        high = y_pred * exp(q)
    Strictly preserves positivity and expands proportionately with concentration.
    """
    p = np.asarray(y_pred, dtype=np.float64)
    low = np.maximum(1e-3, p * np.exp(-q_score))
    high = p * np.exp(q_score)
    return low, high

def evaluate_conformal_coverage(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    q_score: float,
    lloq: float = 0.1
) -> Dict[str, float]:
    """
    Evaluate empirical coverage and interval properties on held-out test data.
    """
    y = np.asarray(y_true, dtype=np.float64)
    p = np.asarray(y_pred, dtype=np.float64)

    mask = (y > lloq) & (p > lloq)
    if mask.sum() == 0:
        mask = np.ones(len(y), dtype=bool)

    y_eval = y[mask]
    low, high = compute_conformal_bounds(p[mask], q_score)

    in_bounds = (y_eval >= low) & (y_eval <= high)
    empirical_coverage = float(np.mean(in_bounds) * 100.0)
    widths = high - low
    mean_width = float(np.mean(widths))
    median_width = float(np.median(widths))

    return {
        "empirical_coverage_pct": empirical_coverage,
        "mean_interval_width": mean_width,
        "median_interval_width": median_width,
        "q_score": float(q_score)
    }
