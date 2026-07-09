from fastapi import APIRouter, Depends

from ..schemas.subscription import SubscriptionRequest
from ..services import SubscriptionService
from .dependencies import get_subscription_service


router = APIRouter(prefix="/api", tags=["subscription"])


@router.post("/subscription")
def create_subscription(
    request: SubscriptionRequest,
    service: SubscriptionService = Depends(get_subscription_service),
) -> dict:
    return service.create(request)
