from fastapi import APIRouter

from ..schemas.realtime import HealthResponse

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
