"""
tests/test_validation.py — Unit tests for dataset validation and schemas.
"""
import unittest
import pandas as pd
import numpy as np

from backend.data.validation import validate_pk_dataset
from backend.data.preprocessing import clean_and_normalize_pk_data

class TestValidation(unittest.TestCase):
    def test_empty_dataset_validation(self):
        df = pd.DataFrame()
        report = validate_pk_dataset(df)
        self.assertFalse(report["is_valid"])
        self.assertTrue(any("empty" in e.lower() for e in report["errors"]))

    def test_missing_required_columns(self):
        df = pd.DataFrame({"Subject": [1, 1], "Time": [0.0, 1.0]})
        report = validate_pk_dataset(df)
        self.assertFalse(report["is_valid"])
        self.assertTrue(any("missing required columns" in e.lower() for e in report["errors"]))

    def test_valid_pk_dataset(self):
        data = {
            "Subject": [1, 1, 1, 2, 2],
            "Time": [0.0, 1.0, 2.0, 0.0, 1.5],
            "conc": [np.nan, 5.2, 4.1, np.nan, 6.8],
            "Rate": [70.0, 70.0, 0.0, 80.0, 0.0],
            "Amt": [100.0, 0.0, 0.0, 120.0, 0.0],
            "Age": [35, 35, 35, 62, 62],
            "Sex": ["Male", "Male", "Male", "Female", "Female"],
            "Ht": [175, 175, 175, 160, 160],
            "Wt": [75, 75, 75, 58, 58]
        }
        df = pd.DataFrame(data)
        report = validate_pk_dataset(df)
        self.assertTrue(report["is_valid"])
        self.assertEqual(report["subject_count"], 2)
        self.assertEqual(report["measured_observations"], 3)

    def test_clean_and_normalize_computes_lbm(self):
        data = {
            "sub": [1], "t": [1.0], "dv": [4.0],
            "infusion_rate": [50.0], "dose": [0.0],
            "age": [40], "gender": ["Male"],
            "height": [180], "weight": [80]
        }
        df = pd.DataFrame(data)
        clean = clean_and_normalize_pk_data(df)
        self.assertIn("Subject", clean.columns)
        self.assertIn("Time", clean.columns)
        self.assertIn("conc", clean.columns)
        self.assertIn("LBM", clean.columns)
        self.assertIn("BMI", clean.columns)
        self.assertIn("BSA", clean.columns)
        self.assertGreater(clean["LBM"].iloc[0], 0)
        self.assertGreater(clean["BMI"].iloc[0], 0)

if __name__ == "__main__":
    unittest.main()
