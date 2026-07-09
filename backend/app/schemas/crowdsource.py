from typing import Literal

from pydantic import BaseModel, Field


class CrowdsourceReport(BaseModel):
    user_id: str = Field(default="demo-user", min_length=1)
    port: str = Field(min_length=1)
    actual_wait_time: int = Field(ge=0, le=180)
    crowd_level: Literal["low", "medium", "high"]
    comment: str = Field(default="", max_length=160)
