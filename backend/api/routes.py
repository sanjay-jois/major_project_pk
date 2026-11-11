"""
api/routes.py — FastAPI REST API endpoints.
"""
from __future__ import annotations
from typing import Optional, List
from fastapi import APIRouter, UploadFile, File, Query, HTTPException, Response
from fastapi.responses import PlainTextResponse

from ..core.config import settings
from ..schemas.requests import (
    TrajectoryRequest,
    SimulationRequest,
    TrainRequest
)
from ..schemas.responses import (
    HealthResponse,
    DatasetSummaryResponse,
    DataPreviewResponse,
    LeaderboardResponse,
    TrajectoryResponse,
    PKSimulationResponse,
    ValidationPlotData
)
from ..services.dataset_service import dataset_service
from ..services.training_service import training_service
from ..pharmacokinetics.mechanistic_model import simulate_ode
from ..ml.predict import predict_trajectory

router = APIRouter(prefix="/api")

@router.get("/health", response_model=HealthResponse)
def health_check():
    """System health check and scientific metadata."""
    return {
        "status": "online",
        "version": settings.app_version,
        "app_title": settings.app_title,
        "disclaimer": settings.disclaimer
    }

@router.post("/data/upload")
async def upload_dataset(file: UploadFile = File(...)):
    """Upload and validate a CSV dataset."""
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported.")

    content = await file.read()
    report = dataset_service.load_csv_bytes(content)
    if not report.get("is_valid"):
        return {
            "status": "error",
            "validation": report,
            "message": "Dataset validation failed. Please review errors."
        }

    summary = dataset_service.get_summary()
    return {
        "status": "success",
        "filename": file.filename,
        "validation": report,
        "summary": summary
    }

@router.get("/data/summary", response_model=DatasetSummaryResponse)
def get_dataset_summary():
    """Retrieve statistical summary and data quality audit for the active dataset."""
    return dataset_service.get_summary()

@router.get("/data/preview", response_model=DataPreviewResponse)
def get_data_preview(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=500),
    subject_id: Optional[int] = Query(None)
):
    """Paginated preview of the active dataset with optional subject filtering."""
    return dataset_service.get_preview(page=page, page_size=page_size, subject_id=subject_id)

@router.get("/data/download")
def download_clean_dataset():
    """Download cleaned and normalized CSV dataset."""
    csv_str = dataset_service.export_clean_csv()
    return PlainTextResponse(
        content=csv_str,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="remifentanil_clean_dataset.csv"'}
    )

@router.get("/subjects")
def list_subjects():
    """List unique subjects in dataset with demographic metrics."""
    return dataset_service.get_subjects_list()

@router.get("/subjects/{subject_id}")
def get_subject(subject_id: int):
    """Retrieve subject demographics, dosing regimen, and measured observations."""
    profile = dataset_service.get_subject_profile(subject_id)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Subject {subject_id} not found in dataset.")
    return profile

@router.post("/models/train")
def train_models(req: TrainRequest):
    """Train selected ML residual models using subject-wise GroupShuffleSplit and conformal calibration."""
    try:
        res = training_service.train_models(
            models=req.models,
            test_size=req.test_size,
            random_state=req.random_state
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/models")
def get_available_models():
    """List available model families, training status, and default model."""
    leaderboard = training_service.get_leaderboard()
    names = [m["model"] for m in leaderboard] if leaderboard else [
        "XGBoost", "CatBoost", "RandomForest", "ExtraTrees",
        "GradientBoosting", "SupportVectorRobust", "BayesianCompartment",
        "StackingEnsemble", "Minto"
    ]
    return {
        "models": names,
        "default": training_service.get_default_model(),
        "is_training": training_service.is_training(),
        "trained_count": len(leaderboard)
    }

@router.get("/models/leaderboard")
def get_model_leaderboard():
    """Retrieve benchmark leaderboard with statistical and clinical metrics."""
    leaderboard = training_service.get_leaderboard()
    if not leaderboard:
        # If not trained yet, trigger fast initial training in background or return empty
        return {
            "models": [],
            "default_model": "XGBoost",
            "message": "Models not yet trained. Click 'Train Models' to evaluate the benchmark."
        }
    return {
        "models": leaderboard,
        "default_model": training_service.get_default_model()
    }

@router.post("/predict")
def predict(req: TrajectoryRequest):
    """Generate forward PK trajectory with mechanistic, ML-corrected, and 95% conformal bounds."""
    # If subject_id provided, load subject patient parameters and regimen if not supplied
    patient_dict = req.patient.model_dump() if req.patient else None
    regimen_dict = req.regimen.model_dump() if req.regimen else None
    observed_points = []

    if req.subject_id is not None:
        sub_profile = dataset_service.get_subject_profile(req.subject_id)
        if sub_profile:
            if not patient_dict:
                patient_dict = sub_profile["patient"]
            if not regimen_dict or (not regimen_dict["infusions"] and not regimen_dict["boluses"]):
                regimen_dict = sub_profile["regimen"]
            observed_points = sub_profile["observations"]
            if req.duration < sub_profile["max_time"]:
                req.duration = sub_profile["max_time"] + 5.0

    if not patient_dict:
        patient_dict = {"age": 40.0, "weight": 70.0, "height": 170.0, "sex": "Male"}
    if not regimen_dict:
        # Default test infusion if none provided
        regimen_dict = {"infusions": [{"start": 0.0, "end": 20.0, "rate": 70.0}], "boluses": []}

    pred_res = predict_trajectory(
        patient=patient_dict,
        regimen=regimen_dict,
        duration_min=req.duration,
        model_name=req.model,
        dt=0.5
    )

    # Compute quick simulation trajectory metrics
    traj = pred_res["trajectory"]
    cp_preds = [pt["Cp_pred"] for pt in traj]
    ce_preds = [pt["Ce"] for pt in traj]
    max_cp = max(cp_preds) if cp_preds else 0.0
    max_ce = max(ce_preds) if ce_preds else 0.0

    return {
        "model": req.model,
        "subject_id": req.subject_id,
        "patient": patient_dict,
        "trajectory": traj,
        "observed": observed_points,
        "metrics": {
            "peak_Cp": round(max_cp, 3),
            "peak_Ce": round(max_ce, 3),
            "duration": req.duration,
            "ode_parameters": pred_res.get("ode_parameters", {})
        }
    }

@router.post("/pk/simulate", response_model=PKSimulationResponse)
def simulate_mechanistic_pk(req: SimulationRequest):
    """Run pure Minto (1997) 3-compartment + effect-site ODE simulation with RK4."""
    patient = {
        "age": req.age,
        "weight": req.weight,
        "height": req.height,
        "sex": req.sex
    }
    infusions = [i.model_dump() for i in req.regimen.infusions]
    boluses = [b.model_dump() for b in req.regimen.boluses]

    res = simulate_ode(
        patient=patient,
        infusions=infusions,
        boluses=boluses,
        duration_min=req.duration,
        dt=req.dt,
        lbm_formula=req.lbm_formula
    )
    return res

@router.get("/validation")
def get_validation_summary(model: Optional[str] = None):
    """Get validation methodology, subject split details, and evaluation protocols."""
    leaderboard = training_service.get_leaderboard()
    target_model = model or training_service.get_default_model()
    model_record = next((m for m in leaderboard if m["model"] == target_model), None)

    return {
        "model": target_model,
        "methodology": "Subject-wise GroupShuffleSplit (60% Train, 20% Calibrate, 20% Held-Out Test)",
        "protocol": "Multiplicative log-residual modeling: r = ln(DV) - ln(Cp_minto)",
        "conformal": "95% Split-conformal prediction interval with distribution-free coverage guarantee",
        "metrics": model_record
    }

@router.get("/validation/plots")
def get_validation_plots(model: Optional[str] = None):
    """Retrieve observed vs. predicted pairs, residuals, and conformal scores for validation plots."""
    plots_data = training_service.get_validation_plots_data(model)
    if not plots_data:
        raise HTTPException(
            status_code=404,
            detail="Validation plots data not available. Please train models first."
        )
    return plots_data
