from datetime import datetime

from pydantic import BaseModel, Field

from .common import Priority, RiskLevel, TravelDirection
from .realtime import DataSourceStatus


class PredictionPreferences(BaseModel):
    priority: Priority = Priority.BALANCED
    max_budget: int | None = Field(default=None, ge=0)


class PredictionRequest(BaseModel):
    origin_id: str = Field(min_length=1)
    destination_id: str = Field(min_length=1)
    target_time: datetime
    preferences: PredictionPreferences = Field(default_factory=PredictionPreferences)


class LocationOption(BaseModel):
    id: str
    name: str
    city: str


class DirectionOption(BaseModel):
    id: TravelDirection
    label: str
    origin_ids: list[str]
    destination_ids: list[str]


class LocationsResponse(BaseModel):
    origins: list[LocationOption]
    destinations: list[LocationOption]
    directions: list[DirectionOption]


class RouteStep(BaseModel):
    mode: str
    label: str
    duration: int
    cost: int


class TrafficCalibration(BaseModel):
    available: bool
    reason: str | None = None
    expected_count: int | None = None
    baseline_count: int | None = None
    pressure: float
    raw_pressure: float
    sample_count: int | None = None
    source: str | None = None
    latest_service_date: str | None = None
    distribution: dict
    model_embedded: bool
    runtime_adjustment_minutes: float


class QueueCalibration(BaseModel):
    available: bool
    reason: str | None = None
    resident_level: str | None = None
    visitor_level: str | None = None
    age_minutes: float | None = None
    horizon_minutes: float | None = None
    freshness_weight: float | None = None
    horizon_weight: float | None = None
    effective_weight: float
    multiplier: float
    adjustment_minutes: float


class OfficialCalibration(BaseModel):
    status: str
    feature_version: str
    calibration_version: str
    traffic: TrafficCalibration
    queue: QueueCalibration
    raw_model_wait_minutes: float
    queue_adjusted_wait_minutes: float
    crowdsource_adjustment_minutes: float
    calibrated_wait_minutes: float
    uncertainty_minutes: float


class PortPrediction(BaseModel):
    port_id: str
    name: str
    name_en: str
    predicted_wait_time: int
    confidence_interval: tuple[int, int]
    risk_level: RiskLevel
    late_risk_percent: int
    total_time: int
    total_cost: int
    estimated_arrival: datetime
    latest_departure: datetime
    buffer_minutes: int
    on_time: bool
    within_budget: bool
    crowdsource_enhanced: bool
    crowdsource_count: int
    route: dict[str, list[RouteStep]]
    anomalies: list[str]
    factors: list[dict]
    historical_sample_count: int
    uncertainty_minutes: float
    prediction_engine: str
    scenario_delta_minutes: int
    official_calibration: OfficialCalibration


class PredictionQuery(BaseModel):
    origin_id: str
    origin_name: str
    destination_id: str
    destination_name: str
    target_time: datetime
    priority: Priority
    max_budget: int | None
    direction: TravelDirection


class PredictionResponse(BaseModel):
    query: PredictionQuery
    ports: list[PortPrediction]
    recommended: str
    recommended_port_id: str
    reason: str
    warnings: list[str]
    generated_at: datetime
    model_version: str
    confidence_level: float
    demo_notice: str
    data_sources: list[DataSourceStatus]
    data_version: str
    direction: TravelDirection
    forecast_run_id: str | None = None
    prediction_engine: str
    scenario: dict
