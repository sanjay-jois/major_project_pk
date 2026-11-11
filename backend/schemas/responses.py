"""
schemas/responses.py — Response Pydantic models.
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

class HealthResponse(BaseModel):
    status: str
    version: str
    app_title: str
    disclaimer: str

class DatasetSummaryResponse(BaseModel):
    total_rows: int
    total_subjects: int
    drug: str
    columns: List[str]
    missing_values: Dict[str, int]
    infinite_values: Dict[str, int]
    duplicates_count: int
    numeric_stats: Dict[str, Dict[str, float]]
    demographics: Dict[str, Any]
    lloq: float

class DataPreviewResponse(BaseModel):
    total_rows: int
    page: int
    page_size: int
    columns: List[str]
    rows: List[Dict[str, Any]]

class ModelMetric(BaseModel):
    model: str
    MAE: float
    RMSE: float
    R2: float
    MDPE: float
    MDAPE: float
    WAPE: float
    accuracy_10: float
    accuracy_20: float
    accuracy_30: float
    coverage_95: Optional[float] = None
    mean_interval_width: Optional[float] = None
    training_time_sec: Optional[float] = None
    is_baseline: bool = False
    description: Optional[str] = None

class LeaderboardResponse(BaseModel):
    models: List[ModelMetric]
    default_model: str
    last_trained: Optional[str] = None

class TrajectoryPoint(BaseModel):
    time: float
    Cp_minto: float
    Cp_pred: float
    Ce: float
    conformal_low: Optional[float] = None
    conformal_high: Optional[float] = None
    infusion_rate: float

class ObservedPoint(BaseModel):
    time: float
    conc: float

class TrajectoryResponse(BaseModel):
    model: str
    subject_id: Optional[int]
    patient: Dict[str, Any]
    trajectory: List[TrajectoryPoint]
    observed: List[ObservedPoint]
    metrics: Dict[str, Any]

class ValidationPlotData(BaseModel):
    observed: List[float]
    predicted: List[float]
    residuals: List[float]
    times: List[float]
    is_infusion: List[bool]
    subjects: List[int]
    conformal_q95: float
    empirical_coverage: float

class PKSimulationResponse(BaseModel):
    time: List[float]
    Cp: List[float]
    Ce: List[float]
    A1: List[float]
    A2: List[float]
    A3: List[float]
    parameters: Dict[str, float]
    summary: Dict[str, Any]
