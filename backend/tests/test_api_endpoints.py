"""
tests/test_api_endpoints.py — Unit tests for API route logic and schemas.
"""
import unittest
from backend.api.routes import (
    health_check,
    get_dataset_summary,
    get_data_preview,
    list_subjects,
    simulate_mechanistic_pk,
    predict,
    get_available_models
)
from backend.schemas.requests import SimulationRequest, TrajectoryRequest, RegimenInput, InfusionSegment, PatientParams

class TestAPIRouteLogic(unittest.TestCase):
    def test_health_check(self):
        resp = health_check()
        self.assertEqual(resp["status"], "online")
        self.assertIn("version", resp)
        self.assertIn("disclaimer", resp)

    def test_dataset_summary(self):
        resp = get_dataset_summary()
        self.assertGreater(resp["total_rows"], 0)
        self.assertGreater(resp["total_subjects"], 0)
        self.assertIn("columns", resp)
        self.assertIn("demographics", resp)

    def test_data_preview(self):
        resp = get_data_preview(page=1, page_size=10, subject_id=None)
        self.assertEqual(resp["page"], 1)
        self.assertLessEqual(len(resp["rows"]), 10)
        self.assertIn("columns", resp)

    def test_list_subjects(self):
        subs = list_subjects()
        self.assertIsInstance(subs, list)
        self.assertGreater(len(subs), 0)
        self.assertIn("subject_id", subs[0])

    def test_simulate_mechanistic_pk(self):
        req = SimulationRequest(
            age=45.0, weight=75.0, height=175.0, sex="Male",
            regimen=RegimenInput(
                infusions=[InfusionSegment(start=0.0, end=15.0, rate=60.0)],
                boluses=[]
            ),
            duration=45.0, dt=0.1
        )
        resp = simulate_mechanistic_pk(req)
        self.assertIn("time", resp)
        self.assertIn("Cp", resp)
        self.assertIn("Ce", resp)
        self.assertIn("summary", resp)
        self.assertGreater(resp["summary"]["peak_Cp"], 0)

    def test_predict_trajectory(self):
        req = TrajectoryRequest(
            patient=PatientParams(age=40.0, weight=70.0, height=170.0, sex="Male"),
            regimen=RegimenInput(
                infusions=[InfusionSegment(start=0.0, end=20.0, rate=70.0)],
                boluses=[]
            ),
            duration=60.0,
            model="Minto"
        )
        resp = predict(req)
        self.assertIn("trajectory", resp)
        self.assertGreater(len(resp["trajectory"]), 0)
        self.assertIn("metrics", resp)

    def test_get_available_models(self):
        resp = get_available_models()
        self.assertIn("models", resp)
        self.assertIn("default", resp)
        self.assertGreater(len(resp["models"]), 0)

if __name__ == "__main__":
    unittest.main()
