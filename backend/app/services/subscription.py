from datetime import datetime, timedelta

from ..repositories import DemoRepository
from ..schemas.subscription import SubscriptionRequest


class SubscriptionService:
    def __init__(self, repository: DemoRepository):
        self._repository = repository

    def create(self, request: SubscriptionRequest) -> dict:
        subscription_id = f"sub-{self._repository.subscription_count() + 1:03d}"
        deadline = datetime.strptime(request.routine.arrival_deadline, "%H:%M")
        next_alert = deadline - timedelta(minutes=75)
        subscription = {
            "subscription_id": subscription_id,
            "user_id": request.user_id,
            "routine": request.routine.model_dump(),
            "alerts": request.alerts.model_dump(),
        }
        self._repository.add_subscription(subscription)
        return {
            **subscription,
            "next_alert": next_alert.strftime("%H:%M"),
            "message": (
                "订阅已设置，将在预计出发前30分钟"
                f"（约{next_alert.strftime('%H:%M')}）提醒。"
            ),
        }
