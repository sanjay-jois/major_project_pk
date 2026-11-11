"""
schemas/requests.py — Request Pydantic models.
"""
from typing import List, Optional
from pydantic import BaseModel, Field

class PatientParams(BaseModel):
    age: float = Field(..., ge=1, le=120, description="Patient age in years")
    weight: float = Field(..., ge=2, le=300, description="Patient weight in kg")
    height: float = Field(..., ge=40, le=250, description="Patient height in cm")
    sex: str = Field("Male", description="Sex ('Male' or 'Female')")

class InfusionSegment(BaseModel):
    start: float = Field(..., ge=0, description="Start time in minutes")
    end: float = Field(..., ge=0, description="End time in minutes")
    rate: float = Field(..., ge=0, description="Infusion rate in ug/min")

class BolusDose(BaseModel):
    time: float = Field(..., ge=0, description="Time of bolus in minutes")
    amt: float = Field(..., ge=0, description="Bolus amount in ug")

class RegimenInput(BaseModel):
    infusions: List[InfusionSegment] = []
    boluses: List[BolusDose] = []

class TrajectoryRequest(BaseModel):
    patient: Optional[PatientParams] = None
    regimen: Optional[RegimenInput] = None
    duration: float = Field(90.0, ge=5, le=720, description="Simulation duration in minutes")
    model: str = Field("XGBoost", description="Model name or 'Minto'")
    subject_id: Optional[int] = Field(None, description="Preset subject ID from dataset if applicable")

class SimulationRequest(BaseModel):
    age: float = Field(40.0, ge=1, le=120)
    weight: float = Field(70.0, ge=2, le=300)
    height: float = Field(170.0, ge=40, le=250)
    sex: str = Field("Male")
    regimen: RegimenInput = Field(default_factory=RegimenInput)
    duration: float = Field(90.0, ge=5, le=720)
    dt: float = Field(0.05, ge=0.005, le=1.0)
    lbm_formula: str = Field("james", description="'james' or 'janmahasatian'")

class TrainRequest(BaseModel):
    models: Optional[List[str]] = None
    test_size: float = Field(0.2, ge=0.1, le=0.5)
    random_state: int = Field(42, ge=0)
