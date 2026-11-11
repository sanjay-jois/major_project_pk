"""
core/config.py — Application settings and configuration.
"""
from pathlib import Path
from pydantic import BaseModel
import os

BASE_DIR = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = BASE_DIR / "backend"
DATA_DIR = BASE_DIR / "data"
ARTIFACTS_DIR = BACKEND_DIR / "artifacts"
ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_DATASET = DATA_DIR / "Kaggle_PK_Remifentanil.csv"
LLOQ = 0.1  # Lower Limit of Quantification (ng/mL)

class Settings(BaseModel):
    app_title: str = "PK-ML Clinical Dashboard"
    app_version: str = "2.0.0"
    app_subtitle: str = "Grey-Box Pharmacokinetic Modeling & Clinical Analytics"
    disclaimer: str = (
        "For research and educational use only. Predictions are not intended to "
        "guide clinical treatment or dosing decisions."
    )
    debug: bool = os.getenv("DEBUG", "False").lower() in ("true", "1")
    host: str = os.getenv("HOST", "127.0.0.1")
    port: int = int(os.getenv("PORT", "8000"))
    allowed_origins: list[str] = [
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*"
    ]

settings = Settings()
