from datetime import datetime, timedelta

from ..config import DEFAULT_SAFETY_BUFFER_MINUTES
from ..exceptions import DomainValidationError
from ..repositories import DemoRepository
from ..schemas.prediction import PredictionPreferences, PredictionRequest


class PredictionService:
    def __init__(
        self,
        repository: DemoRepository,
        safety_buffer_minutes: int = DEFAULT_SAFETY_BUFFER_MINUTES,
    ):
        self._repository = repository
        self._safety_buffer_minutes = safety_buffer_minutes

    def get_locations(self) -> dict:
        return self._repository.get_locations()

    @staticmethod
    def _normalize_target(target_time: datetime, scenario_time: datetime) -> datetime:
        if target_time.tzinfo is not None and scenario_time.tzinfo is None:
            return target_time.replace(tzinfo=None)
        return target_time

    def _projected_wait(
        self,
        port: dict,
        target_time: datetime,
        scenario_time: datetime,
        reports: list[dict],
    ) -> int:
        horizon = max(0, int((target_time - scenario_time).total_seconds() / 60))
        point = min(port["forecast"], key=lambda item: abs(item["offset_minutes"] - horizon))
        wait = float(point["wait"])

        port_reports = [report for report in reports if report["port"] == port["name"]][-3:]
        if port_reports:
            reported_average = sum(
                report["actual_wait_time"] for report in port_reports
            ) / len(port_reports)
            wait = wait * 0.7 + reported_average * 0.3
        return max(1, round(wait))

    @staticmethod
    def _risk_for(wait: int, upper: int) -> tuple[str, int]:
        late_risk = min(45, max(5, round(wait * 0.55 + (upper - wait) * 1.8)))
        if late_risk >= 25:
            return "high", late_risk
        if late_risk >= 15:
            return "medium", late_risk
        return "low", late_risk

    def _prediction_for_port(
        self,
        port: dict,
        origin_id: str,
        destination_id: str,
        target_time: datetime,
        scenario_time: datetime,
        max_budget: int | None,
        reports: list[dict],
    ) -> dict:
        access = self._repository.get_access_leg(origin_id, port["id"])
        onward = self._repository.get_onward_leg(port["id"], destination_id)
        wait = self._projected_wait(port, target_time, scenario_time, reports)
        lower = max(1, round(wait * 0.78))
        upper = round(wait * 1.25)
        total_time = access["duration"] + wait + onward["duration"]
        total_cost = access["cost"] + onward["cost"]
        estimated_arrival = scenario_time + timedelta(minutes=total_time)
        latest_departure = target_time - timedelta(
            minutes=total_time + self._safety_buffer_minutes
        )
        buffer_minutes = int((target_time - estimated_arrival).total_seconds() / 60)
        risk_level, late_risk = self._risk_for(wait, upper)
        recent_count = sum(1 for report in reports if report["port"] == port["name"])

        return {
            "port_id": port["id"],
            "name": port["name"],
            "name_en": port["name_en"],
            "predicted_wait_time": wait,
            "confidence_interval": [lower, upper],
            "risk_level": risk_level,
            "late_risk_percent": late_risk,
            "total_time": total_time,
            "total_cost": total_cost,
            "estimated_arrival": estimated_arrival,
            "latest_departure": latest_departure,
            "buffer_minutes": buffer_minutes,
            "on_time": estimated_arrival <= target_time,
            "within_budget": max_budget is None or total_cost <= max_budget,
            "crowdsource_enhanced": recent_count > 0,
            "crowdsource_count": recent_count,
            "route": {
                "steps": [
                    access,
                    {
                        "mode": "border",
                        "label": f"{port['name']}口岸通关",
                        "duration": wait,
                        "cost": 0,
                    },
                    onward,
                ]
            },
            "anomalies": port.get("anomalies", []),
        }

    @staticmethod
    def _preference_key(item: dict, preferences: PredictionPreferences) -> tuple:
        if preferences.priority == "fastest":
            return item["total_time"], item["late_risk_percent"], item["total_cost"]
        if preferences.priority == "cheapest":
            return item["total_cost"], item["total_time"], item["late_risk_percent"]
        score = (
            item["total_time"]
            + item["late_risk_percent"] * 1.5
            + item["total_cost"] * 0.12
        )
        return score, item["total_time"], item["total_cost"]

    def _choose_recommended(
        self,
        predictions: list[dict],
        preferences: PredictionPreferences,
    ) -> tuple[dict, list[str]]:
        warnings: list[str] = []
        within_budget = [item for item in predictions if item["within_budget"]]
        if not within_budget:
            warnings.append("没有路线满足预算上限，已推荐费用最低的可用方案。")
            return (
                min(
                    predictions,
                    key=lambda item: (
                        item["total_cost"],
                        not item["on_time"],
                        item["total_time"],
                    ),
                ),
                warnings,
            )

        on_time = [item for item in within_budget if item["on_time"]]
        if on_time:
            return min(on_time, key=lambda item: self._preference_key(item, preferences)), warnings

        warnings.append("按当前场景时间出发，所有预算内路线均无法准时到达。")
        return (
            max(
                within_budget,
                key=lambda item: (
                    item["buffer_minutes"],
                    -item["late_risk_percent"],
                    -item["total_cost"],
                ),
            ),
            warnings,
        )

    def predict(self, request: PredictionRequest) -> dict:
        origin = self._repository.find_location(request.origin_id, "origins")
        if origin is None:
            raise DomainValidationError(f"Unsupported origin_id: {request.origin_id}")
        destination = self._repository.find_location(
            request.destination_id,
            "destinations",
        )
        if destination is None:
            raise DomainValidationError(
                f"Unsupported destination_id: {request.destination_id}"
            )

        port_state = self._repository.get_port_state()
        reports = self._repository.get_reports()
        scenario_time = datetime.fromisoformat(port_state["timestamp"])
        target_time = self._normalize_target(request.target_time, scenario_time)
        predictions = [
            self._prediction_for_port(
                port,
                request.origin_id,
                request.destination_id,
                target_time,
                scenario_time,
                request.preferences.max_budget,
                reports,
            )
            for port in port_state["ports"]
        ]
        recommended, warnings = self._choose_recommended(
            predictions,
            request.preferences,
        )
        ordered = sorted(
            predictions,
            key=lambda item: (
                item["port_id"] != recommended["port_id"],
                item["total_time"],
            ),
        )

        if recommended["on_time"]:
            reason = (
                f"{recommended['name']}在当前偏好下综合最优；最晚建议"
                f"{recommended['latest_departure'].strftime('%H:%M')}出发，"
                f"预计全程{recommended['total_time']}分钟，"
                f"可预留{recommended['buffer_minutes']}分钟。"
            )
        else:
            reason = (
                f"当前已无法准时到达；{recommended['name']}预计迟到最少，"
                f"全程约{recommended['total_time']}分钟。"
            )

        return {
            "query": {
                "origin_id": origin["id"],
                "origin_name": origin["name"],
                "destination_id": destination["id"],
                "destination_name": destination["name"],
                "target_time": target_time,
                "priority": request.preferences.priority,
                "max_budget": request.preferences.max_budget,
            },
            "ports": ordered,
            "recommended": recommended["name"],
            "recommended_port_id": recommended["port_id"],
            "reason": reason,
            "warnings": warnings,
            "generated_at": scenario_time,
            "demo_notice": "结果由本地确定性地点矩阵、规则预测与众包样本生成，不代表真实口岸状态。",
        }
