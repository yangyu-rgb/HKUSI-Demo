from datetime import datetime

from pydantic import BaseModel

from .common import CrowdLevel, RiskLevel


class ForecastPoint(BaseModel):
    offset_minutes: int
    wait: int


class PortStatus(BaseModel):
    id: str
    name: str
    name_en: str
    current_wait: int
    status: str
    crowd_level: CrowdLevel
    special_channels: list[str]
    passenger_flow: str
    forecast: list[ForecastPoint]
    anomalies: list[str]
    crowdsource_count: int


class ServiceAlert(BaseModel):
    type: str
    message: str
    severity: RiskLevel


class RealtimeResponse(BaseModel):
    timestamp: datetime
    source: str
    ports: list[PortStatus]
    alerts: list[ServiceAlert]


class HealthResponse(BaseModel):
    status: str
    service: str
    mode: str
