from enum import Enum
from typing import Any

from pydantic import BaseModel


class Priority(str, Enum):
    FASTEST = "fastest"
    CHEAPEST = "cheapest"
    BALANCED = "balanced"


class CrowdLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ErrorBody(BaseModel):
    code: str
    message: str
    details: Any
    request_id: str


class ErrorResponse(BaseModel):
    error: ErrorBody
