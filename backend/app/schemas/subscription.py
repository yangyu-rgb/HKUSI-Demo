from typing import Literal

from pydantic import BaseModel, Field


Priority = Literal["fastest", "cheapest", "balanced"]


class Routine(BaseModel):
    departure: str = Field(min_length=1)
    destination: str = Field(min_length=1)
    days: list[str] = Field(min_length=1)
    arrival_deadline: str = Field(pattern=r"^\d{2}:\d{2}$")
    priority: Priority = "balanced"


class AlertPreferences(BaseModel):
    advance_reminder: bool = True
    anomaly_alert: bool = True
    better_route_alert: bool = True


class SubscriptionRequest(BaseModel):
    user_id: str = Field(default="demo-user", min_length=1)
    routine: Routine
    alerts: AlertPreferences = Field(default_factory=AlertPreferences)
