from pydantic import BaseModel, Field

from .common import Priority


class Routine(BaseModel):
    origin_id: str = Field(min_length=1)
    destination_id: str = Field(min_length=1)
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


class SubscriptionUpdate(BaseModel):
    routine: Routine
    alerts: AlertPreferences = Field(default_factory=AlertPreferences)


class SubscriptionRecord(BaseModel):
    subscription_id: str
    user_id: str
    routine: Routine
    alerts: AlertPreferences
    created_at: str
    updated_at: str
    next_alert: str | None = None
    message: str | None = None


class SubscriptionListResponse(BaseModel):
    subscriptions: list[SubscriptionRecord]
    total: int
