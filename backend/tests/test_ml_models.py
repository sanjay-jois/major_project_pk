"""
tests/test_ml_models.py — Unit tests for ML regression metrics, models, and conformal calibration.
"""
import unittest
import numpy as np

from backend.ml.metrics import calculate_pk_metrics
from backend.pharmacokinetics.conformal import (
    calibrate_split_conformal,
    compute_conformal_bounds,
    evaluate_conformal_coverage
)
from backend.pharmacokinetics.greybox import reconstruct_concentration, compute_residuals

class TestMLModels(unittest.TestCase):
    def test_pk_metrics_perfect_predictions(self):
        y_true = np.array([5.0, 10.0, 15.0, 20.0])
        y_pred = np.array([5.0, 10.0, 15.0, 20.0])

        m = calculate_pk_metrics(y_true, y_pred)
        self.assertEqual(m["MAE"], 0.0)
        self.assertEqual(m["RMSE"], 0.0)
        self.assertEqual(m["R2"], 1.0)
        self.assertEqual(m["MDPE"], 0.0)
        self.assertEqual(m["MDAPE"], 0.0)
        self.assertEqual(m["WAPE"], 0.0)
        self.assertEqual(m["accuracy_10"], 100.0)

    def test_pk_metrics_with_bias(self):
        y_true = np.array([10.0, 20.0, 30.0])
        y_pred = np.array([12.0, 24.0, 36.0])  # +20% over-prediction

        m = calculate_pk_metrics(y_true, y_pred)
        self.assertGreater(m["MAE"], 0)
        self.assertLess(m["MDPE"], 0)  # (y - p)/p is negative for over-prediction
        self.assertLess(abs(m["MDAPE"] - 16.67), 0.5)

    def test_conformal_calibration_and_coverage(self):
        rng = np.random.default_rng(42)
        y_cal = np.exp(rng.normal(2.0, 0.5, 100))
        # Simulated model with ~10% log-normal error
        y_pred_cal = y_cal * np.exp(rng.normal(0.0, 0.1, 100))

        q = calibrate_split_conformal(y_cal, y_pred_cal, alpha=0.05)
        self.assertGreater(q, 0)

        # Test set
        y_test = np.exp(rng.normal(2.0, 0.5, 100))
        y_pred_test = y_test * np.exp(rng.normal(0.0, 0.1, 100))

        low, high = compute_conformal_bounds(y_pred_test, q)
        self.assertTrue(np.all(low < high))
        self.assertTrue(np.all(low > 0))

        eval_res = evaluate_conformal_coverage(y_test, y_pred_test, q)
        # 95% split conformal should cover approximately 90-100% of points
        self.assertGreaterEqual(eval_res["empirical_coverage_pct"], 88.0)

    def test_log_residuals_and_reconstruction(self):
        y_true = np.array([10.0, 20.0, 5.0])
        cp_minto = np.array([8.0, 22.0, 5.0])

        r = compute_residuals(y_true, cp_minto)
        # Reconstruct with damping = 1.0 should return exact y_true
        reconstructed = reconstruct_concentration(cp_minto, r, damping=1.0)
        np.testing.assert_allclose(y_true, reconstructed, rtol=1e-3)

if __name__ == "__main__":
    unittest.main()
