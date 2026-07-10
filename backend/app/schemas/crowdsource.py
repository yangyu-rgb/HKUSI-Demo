from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from .common import (
    CrossingChannel,
    CrowdLevel,
    ObservationSource,
    ReportQualityLevel,
    TravelDirection,
)


class CrowdsourceReport(BaseModel):
    user_id: str = Field(default="demo-user", min_length=1)
    port: str = Field(min_length=1)
    actual_wait_time: int = Field(ge=0, le=180)
    crowd_level: CrowdLevel
    comment: str = Field(default="", max_length=160)
    forecast_run_id: str | None = None
    forecast_port_id: str | None = None
    direction: TravelDirection = TravelDirection.HONG_KONG_TO_SHENZHEN
    channel: CrossingChannel = CrossingChannel.TRAVELLER
    is_real_observation: bool = False
    training_consent: bool = False

    @model_validator(mode="after")
    def validate_training_consent(self) -> "CrowdsourceReport":
        if self.training_consent and not self.is_real_observation:
            raise ValueError("只有明确声明的实际现场反馈才能授权用于模型训练")
        return self


class CrowdsourceRecord(CrowdsourceReport):
    id: str
    timestamp: datetime
    time_label: str
    quality_score: int = Field(ge=0, le=100)
    quality_level: ReportQualityLevel
    expires_at: datetime
    used_for_prediction: bool
    source_type: ObservationSource
    wait_started_at: datetime | None = None
    wait_ended_at: datetime | None = None
    eligible_for_v2_label: bool


class CrowdsourceFeedResponse(BaseModel):
    reports: list[CrowdsourceRecord]
    total: int


class ForecastFeedbackLink(BaseModel):
    forecast_run_id: str
    forecast_port_id: str
    linked: bool
    labeled: bool
    reason: str | None = None


class CrowdsourceSubmitResponse(BaseModel):
    success: bool
    points_earned: int
    model_updated: bool
    report: CrowdsourceRecord
    message: str
    forecast_feedback: ForecastFeedbackLink | None = None
