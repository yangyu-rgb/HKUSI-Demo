from fastapi import APIRouter, Depends

from ..services import RealtimeService
from .dependencies import get_realtime_service


router = APIRouter(prefix="/api", tags=["realtime"])


@router.get("/realtime")
def realtime(
    service: RealtimeService = Depends(get_realtime_service),
) -> dict:
    return service.get_status()
