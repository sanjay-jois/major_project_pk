"""
tests/test_pk_model.py — Unit tests for Minto pharmacokinetic mechanistic model.
"""
import unittest
import numpy as np

from backend.pharmacokinetics.mechanistic_model import (
    lbm_james,
    lbm_janmahasatian,
    minto_parameters,
    simulate_ode
)

class TestPKModel(unittest.TestCase):
    def test_lbm_formulas(self):
        # 70kg, 170cm male
        lbm_m = lbm_james(70, 170, "Male")
        self.assertTrue(45.0 < lbm_m < 60.0)

        # 60kg, 160cm female
        lbm_f = lbm_james(60, 160, "Female")
        self.assertTrue(35.0 < lbm_f < 50.0)

        # Janmahasatian comparison
        lbm_jan = lbm_janmahasatian(70, 170, "Male")
        self.assertTrue(abs(lbm_m - lbm_jan) < 10.0)

    def test_minto_parameters_positivity(self):
        # Standard healthy volunteer
        p = minto_parameters(age=40.0, lbm=55.0)
        self.assertGreater(p["V1"], 0)
        self.assertGreater(p["V2"], 0)
        self.assertGreater(p["V3"], 0)
        self.assertGreater(p["Cl1"], 0)
        self.assertGreater(p["Cl2"], 0)
        self.assertGreater(p["Cl3"], 0)
        self.assertGreater(p["ke0"], 0)

        # Extreme elderly / high LBM boundary conditions
        p_extreme = minto_parameters(age=90.0, lbm=25.0)
        self.assertGreaterEqual(p_extreme["V1"], 0.5)
        self.assertGreaterEqual(p_extreme["Cl1"], 0.1)

    def test_simulate_ode_run(self):
        patient = {"age": 40.0, "weight": 70.0, "height": 170.0, "sex": "Male"}
        infusions = [{"start": 0.0, "end": 20.0, "rate": 70.0}]
        boluses = [{"time": 0.0, "amt": 50.0}]

        res = simulate_ode(patient, infusions, boluses, duration_min=60.0, dt=0.1)

        self.assertIn("time", res)
        self.assertIn("Cp", res)
        self.assertIn("Ce", res)
        self.assertEqual(len(res["time"]), len(res["Cp"]))
        self.assertGreater(res["summary"]["peak_Cp"], 0)
        self.assertGreater(res["summary"]["peak_Ce"], 0)

        # Concentrations must strictly remain non-negative
        cp_arr = np.array(res["Cp"])
        ce_arr = np.array(res["Ce"])
        self.assertTrue(np.all(cp_arr >= 0.0))
        self.assertTrue(np.all(ce_arr >= 0.0))

        # Effect site Ce lag behind Cp: peak Ce time must be >= 0
        self.assertGreaterEqual(res["summary"]["time_to_peak_Ce"], 0.0)

if __name__ == "__main__":
    unittest.main()
