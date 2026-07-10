from fastapi import APIRouter, Depends

from ..schemas.realtime import HealthResponse, ReadinessHealthResponse
from ..services import DemoService
from .dependencies import get_demo_service

router = APIRouter(tags=["健康检查"])


@router.get(
    "/api/health",
    response_model=HealthResponse,
    summary="检查 API 服务状态",
    response_description="请求成功",
)
def health() -> dict:
    return {
        "status": "ok",
        "service": "crossborder-ai-api",
        "mode": "deterministic-demo",
    }


@router.get(
    "/api/health/live",
    response_model=HealthResponse,
    summary="检查 API 进程存活状态",
)
def live() -> dict:
    return health()


@router.get(
    "/api/health/ready",
    response_model=ReadinessHealthResponse,
    summary="检查 V1 Demo 依赖就绪状态",
)
def ready(service: DemoService = Depends(get_demo_service)) -> dict:
    readiness = service.get_v1_readiness()
    return {
        "status": "ok" if readiness["demo_ready"] else "degraded",
        "service": "crossborder-ai-api",
        "mode": "deterministic-demo",
        "checks": readiness["checks"],
    }
