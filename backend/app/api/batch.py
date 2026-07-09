from fastapi import APIRouter, Depends, Query

from ..schemas.batch import BatchHistoryResponse, BatchRequest, BatchResponse
from ..services import BatchService
from .dependencies import get_batch_service


router = APIRouter(prefix="/api", tags=["企业方案"])


@router.post(
    "/batch",
    response_model=BatchResponse,
    summary="生成并保存企业批量方案",
    response_description="生成成功",
)
def create_batch_plan(
    request: BatchRequest,
    service: BatchService = Depends(get_batch_service),
) -> dict:
    return service.create_plan(request)


@router.get(
    "/batch/plans",
    response_model=BatchHistoryResponse,
    summary="获取近期企业批量方案",
    response_description="请求成功",
)
def list_batch_plans(
    company: str = Query(min_length=1),
    limit: int = Query(default=10, ge=1, le=50),
    service: BatchService = Depends(get_batch_service),
) -> dict:
    return service.list_plans(company, limit)
