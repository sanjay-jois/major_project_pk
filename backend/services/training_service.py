"""
services/training_service.py — Model training management and leaderboard cache.
"""
from __future__ import annotations
from typing import Dict, Any, List, Optional
import json
from pathlib import Path
import threading

from ..core.config import ARTIFACTS_DIR
from .dataset_service import dataset_service
from ..ml.train import train_and_evaluate_all

class TrainingService:
    def __init__(self):
        self._lock = threading.Lock()
        self._is_training = False
        self._last_error: Optional[str] = None
        self._cached_leaderboard: Optional[List[Dict[str, Any]]] = None
        self._default_model = "XGBoost"

    def is_training(self) -> bool:
        return self._is_training

    def get_last_error(self) -> Optional[str]:
        return self._last_error

    def get_leaderboard(self) -> List[Dict[str, Any]]:
        """Return cached leaderboard or load from disk."""
        if self._cached_leaderboard is not None:
            return self._cached_leaderboard

        leaderboard_path = ARTIFACTS_DIR / "leaderboard.json"
        if leaderboard_path.exists():
            try:
                with open(leaderboard_path, "r") as f:
                    data = json.load(f)
                    self._cached_leaderboard = data
                    # Determine default model
                    non_baseline = [m["model"] for m in data if not m.get("is_baseline")]
                    if non_baseline:
                        self._default_model = non_baseline[0]
                    return data
            except Exception as e:
                print(f"[TrainingService] Error reading cached leaderboard: {e}")

        # If not on disk, return empty list (user can click Train)
        return []

    def get_default_model(self) -> str:
        self.get_leaderboard()
        return self._default_model

    def get_validation_plots_data(self, model_name: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Load test-set validation points and residuals for plotting."""
        val_path = ARTIFACTS_DIR / "validation_data.json"
        if not val_path.exists():
            return None

        try:
            with open(val_path, "r") as f:
                val_data = json.load(f)
            if model_name:
                return val_data.get(model_name)
            # Default to first non-minto model
            for k in val_data:
                if k != "Minto":
                    return val_data[k]
            return next(iter(val_data.values()), None)
        except Exception as e:
            print(f"[TrainingService] Error reading validation plots: {e}")
            return None

    def train_models(
        self,
        models: Optional[List[str]] = None,
        test_size: float = 0.2,
        random_state: int = 42
    ) -> Dict[str, Any]:
        """Execute model training on active greybox dataset."""
        if self._is_training:
            return {"status": "busy", "message": "Training is already in progress."}

        with self._lock:
            self._is_training = True
            self._last_error = None
            try:
                greybox_df = dataset_service.get_greybox_dataframe()
                if greybox_df.empty:
                    raise ValueError("No valid PK dataset loaded to train on.")

                res = train_and_evaluate_all(
                    greybox_df=greybox_df,
                    selected_models=models,
                    test_size=test_size,
                    random_state=random_state
                )

                self._cached_leaderboard = res["leaderboard"]
                self._default_model = res["default_model"]

                return {
                    "status": "success",
                    "leaderboard": res["leaderboard"],
                    "default_model": res["default_model"]
                }
            except Exception as e:
                self._last_error = str(e)
                raise e
            finally:
                self._is_training = False

# Singleton instance
training_service = TrainingService()
