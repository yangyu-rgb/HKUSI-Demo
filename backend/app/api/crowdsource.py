from fastapi import APIRouter, Depends, Query

from ..schemas.crowdsource import CrowdsourceReport
from ..services import CrowdsourceService
from .dependencies import get_crowdsource_service


router = APIRouter(prefix="/api/crowdsource", tags=["crowdsource"])


@router.get("/feed")
def crowdsource_feed(
    limit: int = Query(default=8, ge=1, le=30),
    service: CrowdsourceService = Depends(get_crowdsource_service),
) -> dict:
    return service.get_feed(limit)


@router.post("/report")
def submit_crowdsource_report(
    report: CrowdsourceReport,
    service: CrowdsourceService = Depends(get_crowdsource_service),
) -> dict:
    return service.submit(report)
