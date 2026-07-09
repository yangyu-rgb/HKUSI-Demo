from fastapi import Depends, Request

from ..repositories import DemoRepository
from ..services import (
    BatchService,
    CrowdsourceService,
    PredictionService,
    RealtimeService,
    SubscriptionService,
)


def get_repository(request: Request) -> DemoRepository:
    return request.app.state.repository


def get_prediction_service(
    repository: DemoRepository = Depends(get_repository),
) -> PredictionService:
    return PredictionService(repository)


def get_realtime_service(
    repository: DemoRepository = Depends(get_repository),
) -> RealtimeService:
    return RealtimeService(repository)


def get_crowdsource_service(
    repository: DemoRepository = Depends(get_repository),
) -> CrowdsourceService:
    return CrowdsourceService(repository)


def get_subscription_service(
    repository: DemoRepository = Depends(get_repository),
) -> SubscriptionService:
    return SubscriptionService(repository)


def get_batch_service(
    repository: DemoRepository = Depends(get_repository),
) -> BatchService:
    return BatchService(repository)
