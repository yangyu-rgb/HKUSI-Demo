from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class CommercialPlan(BaseModel):
    id: str
    name: str
    audience: str
    monthly_price_hkd: int
    yearly_price_hkd: int
    description: str
    features: list[str]
    highlighted: bool = False


class CommercialPlansResponse(BaseModel):
    plans: list[CommercialPlan]
    demo_notice: str


class CommercialCheckoutRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    plan_id: Literal["starter", "professional", "enterprise"]
    billing_cycle: Literal["monthly", "yearly"]


class CommercialSubscription(BaseModel):
    account_id: str
    persona_id: str
    organization_id: str
    plan_id: str
    plan_name: str
    billing_cycle: str
    status: str
    price_hkd: int
    started_at: datetime
    renews_at: datetime
    receipt_id: str
    demo_payment: bool = True


class CommercialSubscriptionResponse(BaseModel):
    subscription: CommercialSubscription | None = None
    demo_notice: str


class CommercialCheckoutResponse(BaseModel):
    success: bool
    subscription: CommercialSubscription
    message: str
