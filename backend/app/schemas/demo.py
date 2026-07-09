from datetime import datetime

from pydantic import BaseModel


class DemoContextResponse(BaseModel):
    scenario_time: datetime
    min_target_time: datetime
    max_target_time: datetime
    poll_interval_seconds: int


class DemoResetResponse(BaseModel):
    success: bool
    seeded: dict[str, int]
    message: str
