from datetime import datetime, timedelta

from ..exceptions import (
    DomainValidationError,
    ErrorCode,
    ResourceNotFoundError,
)
from ..repositories import DemoRepository
from ..schemas.subscription import SubscriptionRequest, SubscriptionUpdate


class SubscriptionService:
    def __init__(self, repository: DemoRepository):
        self._repository = repository

    @staticmethod
    def _next_alert(arrival_deadline: str) -> str:
        deadline = datetime.strptime(arrival_deadline, "%H:%M")
        return (deadline - timedelta(minutes=75)).strftime("%H:%M")

    def _validate_locations(self, origin_id: str, destination_id: str) -> None:
        if self._repository.find_location(origin_id, "origins") is None:
            raise DomainValidationError(
                "不支持该出发地点",
                code=ErrorCode.LOCATION_NOT_FOUND,
                details={"origin_id": origin_id},
            )
        if self._repository.find_location(destination_id, "destinations") is None:
            raise DomainValidationError(
                "不支持该目的地点",
                code=ErrorCode.LOCATION_NOT_FOUND,
                details={"destination_id": destination_id},
            )

    def list(self, user_id: str) -> dict:
        subscriptions = self._repository.list_subscriptions(user_id)
        for item in subscriptions:
            item["next_alert"] = self._next_alert(
                item["routine"]["arrival_deadline"]
            )
        return {"subscriptions": subscriptions, "total": len(subscriptions)}

    def create(self, request: SubscriptionRequest) -> dict:
        routine = request.routine.model_dump(mode="json")
        alerts = request.alerts.model_dump(mode="json")
        self._validate_locations(routine["origin_id"], routine["destination_id"])
        subscription = self._repository.add_subscription(
            {
                "user_id": request.user_id,
                "routine": routine,
                "alerts": alerts,
            }
        )
        subscription["next_alert"] = self._next_alert(routine["arrival_deadline"])
        subscription["message"] = (
            "订阅已设置，将在预计出发前30分钟"
            f"（约{subscription['next_alert']}）提醒。"
        )
        return subscription

    def update(self, subscription_id: str, request: SubscriptionUpdate) -> dict:
        existing = self._repository.get_subscription(subscription_id)
        if existing is None:
            raise ResourceNotFoundError(
                ErrorCode.SUBSCRIPTION_NOT_FOUND,
                "订阅不存在",
                details={"subscription_id": subscription_id},
            )
        routine = request.routine.model_dump(mode="json")
        alerts = request.alerts.model_dump(mode="json")
        self._validate_locations(routine["origin_id"], routine["destination_id"])
        updated = self._repository.update_subscription(
            subscription_id,
            {"routine": routine, "alerts": alerts},
        )
        assert updated is not None
        updated["next_alert"] = self._next_alert(routine["arrival_deadline"])
        updated["message"] = "订阅已更新。"
        return updated

    def delete(self, subscription_id: str) -> None:
        if not self._repository.delete_subscription(subscription_id):
            raise ResourceNotFoundError(
                ErrorCode.SUBSCRIPTION_NOT_FOUND,
                "订阅不存在",
                details={"subscription_id": subscription_id},
            )
