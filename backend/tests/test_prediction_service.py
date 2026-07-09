from datetime import datetime

import pytest

from app.exceptions import DomainValidationError
from app.schemas.prediction import PredictionRequest
from app.services import PredictionService


def request(
    *,
    origin_id: str = "hku",
    destination_id: str = "nanshan-tech",
    target_time: str = "2026-07-09T09:30:00",
    priority: str = "balanced",
    max_budget: int | None = 100,
) -> PredictionRequest:
    return PredictionRequest(
        origin_id=origin_id,
        destination_id=destination_id,
        target_time=target_time,
        preferences={"priority": priority, "max_budget": max_budget},
    )


def test_location_matrix_changes_route_time(prediction_service: PredictionService) -> None:
    hku = prediction_service.predict(request())
    kowloon = prediction_service.predict(
        request(origin_id="kowloon-tong", destination_id="futian-cbd")
    )

    hku_times = {item["port_id"]: item["total_time"] for item in hku["ports"]}
    kowloon_times = {item["port_id"]: item["total_time"] for item in kowloon["ports"]}
    assert hku_times != kowloon_times
    assert hku["query"]["origin_name"] == "香港大学"
    assert kowloon["query"]["destination_name"] == "深圳福田 CBD"


def test_preferences_change_recommendation(prediction_service: PredictionService) -> None:
    fastest = prediction_service.predict(request(priority="fastest"))
    balanced = prediction_service.predict(request(priority="balanced"))

    assert fastest["recommended"] == "深圳湾"
    assert balanced["recommended"] == "福田"


def test_departure_and_feasibility_are_calculated(
    prediction_service: PredictionService,
) -> None:
    result = prediction_service.predict(request())
    recommended = result["ports"][0]

    assert recommended["on_time"] is True
    assert recommended["buffer_minutes"] > 0
    assert recommended["latest_departure"] < datetime.fromisoformat(
        "2026-07-09T09:30:00"
    )
    assert recommended["estimated_arrival"] <= datetime.fromisoformat(
        "2026-07-09T09:30:00"
    )


def test_all_routes_late_returns_least_late_warning(
    prediction_service: PredictionService,
) -> None:
    result = prediction_service.predict(
        request(target_time="2026-07-09T08:00:00", max_budget=None)
    )

    assert result["ports"][0]["on_time"] is False
    assert any("无法准时" in warning for warning in result["warnings"])


def test_no_route_in_budget_returns_cheapest_warning(
    prediction_service: PredictionService,
) -> None:
    result = prediction_service.predict(request(max_budget=10))

    assert result["ports"][0]["within_budget"] is False
    assert result["recommended"] == "罗湖"
    assert any("预算" in warning for warning in result["warnings"])


def test_unknown_location_is_rejected(prediction_service: PredictionService) -> None:
    with pytest.raises(DomainValidationError, match="Unsupported origin_id"):
        prediction_service.predict(request(origin_id="unknown"))
