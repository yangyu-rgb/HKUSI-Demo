from datetime import datetime

from pydantic import BaseModel

from .realtime import DataSourceStatus


class DemoContextResponse(BaseModel):
    current_time: datetime
    timezone: str
    min_target_time: datetime
    suggested_target_time: datetime
    max_target_time: datetime
    poll_interval_seconds: int


class DemoResetResponse(BaseModel):
    success: bool
    seeded: dict[str, int]
    message: str


class ShadowObservationPortSummary(BaseModel):
    port_id: str
    port_name: str
    observation_count: int
    average_difference_minutes: float | None = None
    average_absolute_difference_minutes: float | None = None


class ShadowObservationSummaryResponse(BaseModel):
    total_observations: int
    available_observations: int
    unavailable_observations: int
    latest_observed_at: datetime | None = None
    ports: list[ShadowObservationPortSummary]


class V2ReadinessCheck(BaseModel):
    name: str
    actual: int
    required: int
    passed: bool


class V2ReadinessPort(BaseModel):
    port_id: str
    label_count: int


class V2ReadinessLabelSource(BaseModel):
    source_type: str
    label_count: int


class V2ReadinessResponse(BaseModel):
    experiment_ready: bool
    production_promotion_ready: bool
    label_count: int
    linked_feedback_count: int
    excluded_feedback_count: int
    label_sources: list[V2ReadinessLabelSource]
    ports: list[V2ReadinessPort]
    distinct_dates: int
    hour_slices: int
    data_versions: list[str]
    statistical_mae_minutes: float | None = None
    shadow_mae_minutes: float | None = None
    shadow_labeled_count: int
    time_split: dict
    checks: list[V2ReadinessCheck]
    data_sources: list[DataSourceStatus]
    coverage_warnings: list[str]
    production_blockers: list[str]
