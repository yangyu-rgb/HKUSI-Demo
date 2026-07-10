from datetime import datetime, timedelta
from hashlib import sha256
import json
import logging
from statistics import NormalDist

from ..clock import Clock, as_hong_kong, ceil_minutes
from ..config import (
    BALANCED_COST_WEIGHT,
    BALANCED_RISK_WEIGHT,
    CONFIDENCE_LEVEL,
    DEFAULT_SAFETY_BUFFER_MINUTES,
    MAX_TARGET_HORIZON_HOURS,
    MIN_TARGET_LEAD_MINUTES,
    MODEL_VERSION,
    RISK_HIGH_THRESHOLD_PERCENT,
    RISK_MEDIUM_THRESHOLD_PERCENT,
)
from ..exceptions import DomainValidationError, ErrorCode
from ..repositories import DemoRepository
from ..ml.shadow import ShadowWaitModel
from ..schemas.common import Priority
from ..schemas.prediction import PredictionPreferences, PredictionRequest
from .wait_forecast import WaitForecastService


logger = logging.getLogger(__name__)


class PredictionService:
    """Compare route choices using a time-weighted statistical wait model."""

    def __init__(
        self,
        repository: DemoRepository,
        clock: Clock,
        safety_buffer_minutes: int = DEFAULT_SAFETY_BUFFER_MINUTES,
        shadow_model: ShadowWaitModel | None = None,
    ):
        self._repository = repository
        self._clock = clock
        self._forecast = WaitForecastService(repository, clock)
        self._safety_buffer_minutes = safety_buffer_minutes
        self._shadow_model = shadow_model

    def get_locations(self) -> dict:
        return self._repository.get_locations()

    @staticmethod
    def _risk_probability(
        predicted_wait: float,
        sigma: float,
        available_border_minutes: float,
    ) -> tuple[str, int]:
        distribution = NormalDist(mu=predicted_wait, sigma=sigma)
        late_probability = 1 - distribution.cdf(available_border_minutes)
        late_risk = min(99, max(1, round(late_probability * 100)))
        if late_risk >= RISK_HIGH_THRESHOLD_PERCENT:
            return "high", late_risk
        if late_risk >= RISK_MEDIUM_THRESHOLD_PERCENT:
            return "medium", late_risk
        return "low", late_risk

    def _prediction_for_port(
        self,
        port: dict,
        origin_id: str,
        destination_id: str,
        direction: str,
        target_time,
        current_time,
        max_budget: int | None,
        reports: list[dict],
        shadow_observations: list[dict],
        record_shadow: bool,
        prediction_inputs: dict,
    ) -> dict:
        access = self._repository.get_access_leg(direction, origin_id, port["id"])
        onward = self._repository.get_onward_leg(
            direction,
            port["id"],
            destination_id,
        )
        estimate = self._forecast.estimate(
            port["name"],
            target_time,
            current_time,
            reports,
        )
        predicted_value = estimate["value"]
        if record_shadow:
            self._append_shadow_observation(
                shadow_observations=shadow_observations,
                port=port,
                target_time=target_time,
                current_time=current_time,
                statistical_wait=predicted_value,
                prediction_inputs=prediction_inputs,
            )
        sigma = estimate["standard_deviation"]
        z_score = NormalDist().inv_cdf(0.5 + CONFIDENCE_LEVEL / 2)
        lower = max(1, round(predicted_value - z_score * sigma))
        upper = round(predicted_value + z_score * sigma)
        wait = max(1, round(predicted_value))
        total_time = access["duration"] + wait + onward["duration"]
        total_cost = access["cost"] + onward["cost"]
        estimated_arrival = current_time + timedelta(minutes=total_time)
        latest_departure = target_time - timedelta(
            minutes=total_time + self._safety_buffer_minutes
        )
        buffer_minutes = int((target_time - estimated_arrival).total_seconds() / 60)
        available_border_minutes = (
            (target_time - current_time).total_seconds() / 60
            - access["duration"]
            - onward["duration"]
        )
        risk_level, late_risk = self._risk_probability(
            predicted_value,
            sigma,
            available_border_minutes,
        )
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
            "crowdsource_enhanced": estimate["crowdsource_count"] > 0,
            "crowdsource_count": estimate["crowdsource_count"],
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
            "factors": estimate["factors"],
            "historical_sample_count": estimate["sample_count"],
            "uncertainty_minutes": round(sigma, 2),
        }

    def _append_shadow_observation(
        self,
        *,
        shadow_observations: list[dict],
        port: dict,
        target_time,
        current_time,
        statistical_wait: float,
        prediction_inputs: dict,
    ) -> None:
        if self._shadow_model is None:
            return
        shadow_wait = self._shadow_model.predict(
            port=port["name"],
            timestamp=target_time,
            weather=prediction_inputs["weather"],
            is_holiday=prediction_inputs["is_holiday"],
        )
        status = self._shadow_model.status
        shadow_observations.append(
            {
                "generated_at": current_time.isoformat(),
                "target_time": target_time.isoformat(),
                "port_id": port["id"],
                "port_name": port["name"],
                "statistical_wait_minutes": round(statistical_wait, 4),
                "shadow_wait_minutes": (
                    round(shadow_wait, 4) if shadow_wait is not None else None
                ),
                "difference_minutes": (
                    round(shadow_wait - statistical_wait, 4)
                    if shadow_wait is not None
                    else None
                ),
                "status": "available" if shadow_wait is not None else "unavailable",
                "model_version": status.model_version,
                "reason": status.reason,
            }
        )

    def _save_shadow_observations(self, observations: list[dict]) -> None:
        if not observations:
            return
        try:
            self._repository.save_shadow_observations(observations)
        except Exception:
            logger.warning("AI v1 影子模型观测记录失败", exc_info=True)

    def _save_forecast_run(
        self,
        *,
        predictions: list[dict],
        shadow_observations: list[dict],
        reports: list[dict],
        query: dict,
        generated_at: datetime,
        target_time: datetime,
        prediction_inputs: dict,
    ) -> str | None:
        run_identity = json.dumps(
            {
                "query": query,
                "generated_at": generated_at.isoformat(),
                "target_time": target_time.isoformat(),
                "model_version": MODEL_VERSION,
                "data_version": prediction_inputs["data_version"],
                "statistical_predictions": [
                    {
                        "port_id": prediction["port_id"],
                        "predicted_wait_time": prediction["predicted_wait_time"],
                        "historical_sample_count": prediction[
                            "historical_sample_count"
                        ],
                    }
                    for prediction in sorted(
                        predictions,
                        key=lambda item: item["port_id"],
                    )
                ],
                "active_crowdsource_reports": [
                    {
                        "id": report["id"],
                        "port": report["port"],
                        "timestamp": report["timestamp"],
                        "quality_score": report["quality_score"],
                    }
                    for report in reports
                    if report["used_for_prediction"]
                ],
            },
            ensure_ascii=False,
            sort_keys=True,
            default=str,
        )
        run_id = f"forecast-{sha256(run_identity.encode('utf-8')).hexdigest()[:12]}"
        shadow_by_port = {
            observation["port_id"]: observation
            for observation in shadow_observations
        }
        ports = []
        for prediction in predictions:
            shadow = shadow_by_port.get(prediction["port_id"])
            ports.append(
                {
                    "port_id": prediction["port_id"],
                    "port_name": prediction["name"],
                    "statistical_wait_minutes": prediction["predicted_wait_time"],
                    "shadow_wait_minutes": (
                        shadow["shadow_wait_minutes"] if shadow else None
                    ),
                    "shadow_status": shadow["status"] if shadow else "unavailable",
                    "shadow_reason": (
                        shadow["reason"] if shadow else "AI v1 影子模型未加载或未记录"
                    ),
                    "features": {
                        "weather": prediction_inputs["weather"],
                        "is_holiday": prediction_inputs["is_holiday"],
                        "data_version": prediction_inputs["data_version"],
                        "historical_sample_count": prediction[
                            "historical_sample_count"
                        ],
                        "crowdsource_count": prediction["crowdsource_count"],
                        "event_factors": [
                            factor
                            for factor in prediction["factors"]
                            if factor["code"] in {"holiday_calendar", "recurring_event"}
                        ],
                    },
                }
            )
        try:
            self._repository.save_forecast_run(
                {
                    "id": run_id,
                    "generated_at": generated_at.isoformat(),
                    "target_time": target_time.isoformat(),
                    "query": query,
                    "model_version": MODEL_VERSION,
                    "data_version": prediction_inputs["data_version"],
                    "data_sources": prediction_inputs["data_sources"],
                    "direction": query["direction"],
                },
                ports,
            )
            return run_id
        except Exception:
            logger.warning("预测运行记录失败", exc_info=True)
            return None

    @staticmethod
    def _preference_key(item: dict, preferences: PredictionPreferences) -> tuple:
        if preferences.priority == Priority.FASTEST:
            return item["total_time"], item["late_risk_percent"], item["total_cost"]
        if preferences.priority == Priority.CHEAPEST:
            return item["total_cost"], item["total_time"], item["late_risk_percent"]
        score = (
            item["total_time"]
            + item["late_risk_percent"] * BALANCED_RISK_WEIGHT
            + item["total_cost"] * BALANCED_COST_WEIGHT
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
            return min(
                predictions,
                key=lambda item: (
                    item["total_cost"],
                    not item["on_time"],
                    item["total_time"],
                ),
            ), warnings
        on_time = [item for item in within_budget if item["on_time"]]
        if on_time:
            return min(
                on_time,
                key=lambda item: self._preference_key(item, preferences),
            ), warnings
        warnings.append("按当前香港时间出发，所有预算内路线均无法准时到达。")
        return max(
            within_budget,
            key=lambda item: (
                item["buffer_minutes"],
                -item["late_risk_percent"],
                -item["total_cost"],
            ),
        ), warnings

    def predict(
        self,
        request: PredictionRequest,
        *,
        current_time: datetime | None = None,
        record_shadow: bool = True,
    ) -> dict:
        origin = self._repository.find_location(request.origin_id, "origins")
        if origin is None:
            raise DomainValidationError(
                "不支持该出发地点",
                code=ErrorCode.LOCATION_NOT_FOUND,
                details={"origin_id": request.origin_id},
            )
        destination = self._repository.find_location(
            request.destination_id,
            "destinations",
        )
        if destination is None:
            raise DomainValidationError(
                "不支持该目的地点",
                code=ErrorCode.LOCATION_NOT_FOUND,
                details={"destination_id": request.destination_id},
            )

        direction = self._repository.infer_direction(
            request.origin_id,
            request.destination_id,
        )
        if direction is None:
            raise DomainValidationError(
                "出发地与目的地必须位于深港两侧",
                code=ErrorCode.VALIDATION_ERROR,
                details={
                    "origin_id": request.origin_id,
                    "destination_id": request.destination_id,
                },
            )

        current_time = as_hong_kong(
            current_time or self._clock.now()
        ).replace(microsecond=0)
        target_time = as_hong_kong(request.target_time)
        minimum = ceil_minutes(
            current_time + timedelta(minutes=MIN_TARGET_LEAD_MINUTES),
            1,
        )
        maximum = current_time + timedelta(hours=MAX_TARGET_HORIZON_HOURS)
        if not minimum <= target_time <= maximum:
            raise DomainValidationError(
                "目标时间超出允许范围",
                code=ErrorCode.TARGET_TIME_OUT_OF_RANGE,
                details={
                    "min_target_time": minimum.isoformat(),
                    "max_target_time": maximum.isoformat(),
                },
            )

        snapshot, reports = self._forecast.build_snapshot(current_time)
        prediction_inputs = self._repository.get_prediction_input_context(target_time)
        shadow_observations: list[dict] = []
        predictions = [
            self._prediction_for_port(
                port,
                request.origin_id,
                request.destination_id,
                direction,
                target_time,
                current_time,
                request.preferences.max_budget,
                reports,
                shadow_observations,
                record_shadow,
                prediction_inputs,
            )
            for port in snapshot["ports"]
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
        query = {
            "origin_id": origin["id"],
            "origin_name": origin["name"],
            "destination_id": destination["id"],
            "destination_name": destination["name"],
            "target_time": target_time,
            "priority": request.preferences.priority,
            "max_budget": request.preferences.max_budget,
            "direction": direction,
        }
        self._save_shadow_observations(shadow_observations)
        forecast_run_id = (
            self._save_forecast_run(
                predictions=predictions,
                shadow_observations=shadow_observations,
                reports=reports,
                query=query,
                generated_at=current_time,
                target_time=target_time,
                prediction_inputs=prediction_inputs,
            )
            if record_shadow
            else None
        )
        return {
            "query": query,
            "ports": ordered,
            "recommended": recommended["name"],
            "recommended_port_id": recommended["port_id"],
            "reason": reason,
            "warnings": warnings,
            "generated_at": current_time,
            "model_version": MODEL_VERSION,
            "confidence_level": CONFIDENCE_LEVEL,
            "demo_notice": "结果由香港实时时钟、本地模拟历史、交通矩阵与众包样本计算，不代表真实口岸状态。",
            "data_sources": prediction_inputs["data_sources"],
            "data_version": prediction_inputs["data_version"],
            "direction": direction,
            "forecast_run_id": forecast_run_id,
        }
