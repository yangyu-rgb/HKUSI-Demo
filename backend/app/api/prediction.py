from fastapi import APIRouter, Depends

from ..schemas.prediction import (
    LocationsResponse,
    PredictionRequest,
    PredictionResponse,
)
from ..services import PredictionService
from .dependencies import get_prediction_service


router = APIRouter(prefix="/api", tags=["prediction"])


@router.get("/locations", response_model=LocationsResponse)
def locations(
    service: PredictionService = Depends(get_prediction_service),
) -> dict:
    return service.get_locations()


@router.post("/predict", response_model=PredictionResponse)
def predict(
    request: PredictionRequest,
    service: PredictionService = Depends(get_prediction_service),
) -> dict:
    return service.predict(request)
