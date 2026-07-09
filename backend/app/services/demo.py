from datetime import datetime, timedelta

from ..config import (
    MAX_TARGET_HORIZON_HOURS,
    MIN_TARGET_LEAD_MINUTES,
    REALTIME_POLL_INTERVAL_SECONDS,
)
from ..repositories import DemoRepository


class DemoService:
    def __init__(self, repository: DemoRepository):
        self._repository = repository

    def get_context(self) -> dict:
        scenario_time = datetime.fromisoformat(
            self._repository.get_port_state()["timestamp"]
        )
        return {
            "scenario_time": scenario_time,
            "min_target_time": scenario_time
            + timedelta(minutes=MIN_TARGET_LEAD_MINUTES),
            "max_target_time": scenario_time
            + timedelta(hours=MAX_TARGET_HORIZON_HOURS),
            "poll_interval_seconds": REALTIME_POLL_INTERVAL_SECONDS,
        }

    def reset(self) -> dict:
        return {
            "success": True,
            "seeded": self._repository.reset_dynamic_data(),
            "message": "Demo 数据已恢复到确定性初始状态。",
        }
