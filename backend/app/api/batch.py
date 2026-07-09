from fastapi import APIRouter, Depends

from ..schemas.batch import BatchRequest
from ..services import BatchService
from .dependencies import get_batch_service


router = APIRouter(prefix="/api", tags=["batch"])


@router.post("/batch")
def create_batch_plan(
    request: BatchRequest,
    service: BatchService = Depends(get_batch_service),
) -> dict:
    return service.create_plan(request)
