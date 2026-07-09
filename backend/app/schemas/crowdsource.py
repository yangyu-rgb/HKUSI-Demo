from pydantic import BaseModel, Field

from .common import CrowdLevel


class CrowdsourceReport(BaseModel):
    user_id: str = Field(default="demo-user", min_length=1)
    port: str = Field(min_length=1)
    actual_wait_time: int = Field(ge=0, le=180)
    crowd_level: CrowdLevel
    comment: str = Field(default="", max_length=160)


class CrowdsourceRecord(CrowdsourceReport):
    id: str
    timestamp: str
    time_label: str


class CrowdsourceFeedResponse(BaseModel):
    reports: list[CrowdsourceRecord]
    total: int


class CrowdsourceSubmitResponse(BaseModel):
    success: bool
    points_earned: int
    model_updated: bool
    report: CrowdsourceRecord
    message: str
