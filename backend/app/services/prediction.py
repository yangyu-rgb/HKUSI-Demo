from datetime import datetime, timedelta
from statistics import NormalDist, fmean, stdev

from ..config import (
    BALANCED_COST_WEIGHT,
    BALANCED_RISK_WEIGHT,
    CONFIDENCE_LEVEL,
    CROWDSOURCE_WEIGHT,
    DEFAULT_SAFETY_BUFFER_MINUTES,
    FORECAST_WEIGHT,
    HISTORY_WEIGHT,
    MAX_TARGET_HORIZON_HOURS,
    MIN_STANDARD_DEVIATION_MINUTES,
    MIN_TARGET_LEAD_MINUTES,
    MODEL_VERSION,
    RISK_HIGH_THRESHOLD_PERCENT,
    RISK_MEDIUM_THRESHOLD_PERCENT,
    TREND_UNCERTAINTY_FACTOR,
)
from ..exceptions import DomainValidationError, ErrorCode
from ..repositories import DemoRepository
from ..schemas.common import Priority
from ..schemas.prediction import PredictionPreferences, PredictionRequest
from .report_quality import evaluate_reports, quality_weighted_wait


class PredictionService:
    """Builds explainable deterministic route predictions from three signals.

    The demo blends an interpolated port forecast, a comparable historical
    bucket, and recent crowdsource waits. Uncertainty comes from historical
    volatility and local forecast slope. A production deployment can replace
    this service with a trained model without changing the API or repositories.
    """

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

    @staticmethod
    def _interpolate_forecast(port: dict, horizon_minutes: int) -> tuple[float, float]:
        """Linearly interpolate forecast points and return value plus hourly slope."""
        points = sorted(port["forecast"], key=lambda item: item["offset_minutes"])
        horizon = min(max(horizon_minutes, 0), points[-1]["offset_minutes"])
        lower = points[0]
        upper = points[-1]
        for index in range(len(points) - 1):
            if points[index]["offset_minutes"] <= horizon <= points[index + 1]["offset_minutes"]:
                lower = points[index]
                upper = points[index + 1]
                break
        span = max(upper["offset_minutes"] - lower["offset_minutes"], 1)
        fraction = (horizon - lower["offset_minutes"]) / span
        value = lower["wait"] + (upper["wait"] - lower["wait"]) * fraction
        hourly_slope = abs(upper["wait"] - lower["wait"]) * (60 / span)
        return value, hourly_slope

    def _historical_stats(self, port_name: str, target_time: datetime) -> tuple[float, float, int, str]:
        """Return comparable historical mean, standard deviation, count, and bucket."""
        records = self._repository.get_history(port_name)
        weekday_group = target_time.weekday() < 5
        hour_records = [
            record
            for record in records
            if (record["timestamp"].weekday() < 5) == weekday_group
            and abs(record["timestamp"].hour - target_time.hour) <= 1
        ]
        weather_condition = self._repository.get_weather()["condition"]
        current_weather = (
            "rain"
            if "rain" in weather_condition or "thunder" in weather_condition
            else "clear"
        )
        weather_records = [
            record for record in hour_records if record["weather"] == current_weather
        ]
        comparable = weather_records if len(weather_records) >= 6 else hour_records
        values = [record["wait_minutes"] for record in comparable]
        if not values:
            values = [record["wait_minutes"] for record in records]
        sigma = stdev(values) if len(values) > 1 else MIN_STANDARD_DEVIATION_MINUTES
        bucket = (
            f"{'工作日' if weekday_group else '周末'}"
            f" {target_time.hour:02d}:00±1h · {current_weather}"
        )
        return fmean(values), max(sigma, MIN_STANDARD_DEVIATION_MINUTES), len(values), bucket

    @staticmethod
    def _normalized_components(
        forecast_value: float,
        historical_mean: float,
        crowd_mean: float | None,
    ) -> tuple[float, list[dict]]:
        components = [
            {
                "code": "forecast_trend",
                "label": "口岸趋势预测",
                "value_minutes": round(forecast_value, 1),
                "configured_weight": FORECAST_WEIGHT,
            },
            {
                "code": "historical_bucket",
                "label": "相似历史时段",
                "value_minutes": round(historical_mean, 1),
                "configured_weight": HISTORY_WEIGHT,
            },
        ]
        if crowd_mean is not None:
            components.append(
                {
                    "code": "crowdsource",
                    "label": "近期现场反馈",
                    "value_minutes": round(crowd_mean, 1),
                    "configured_weight": CROWDSOURCE_WEIGHT,
                }
            )
        total_weight = sum(item["configured_weight"] for item in components)
        value = 0.0
        for item in components:
            item["effective_weight"] = round(item["configured_weight"] / total_weight, 3)
            value += item["value_minutes"] * item["effective_weight"]
        return value, components

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
        target_time: datetime,
        scenario_time: datetime,
        max_budget: int | None,
        reports: list[dict],
    ) -> dict:
        access = self._repository.get_access_leg(origin_id, port["id"])
        onward = self._repository.get_onward_leg(port["id"], destination_id)
        horizon = int((target_time - scenario_time).total_seconds() / 60)
        forecast_value, hourly_slope = self._interpolate_forecast(port, horizon)
        historical_mean, historical_sigma, sample_count, bucket = self._historical_stats(
            port["name"],
            target_time,
        )
        port_reports = [
            report
            for report in reports
            if report["port"] == port["name"]
            and report["used_for_prediction"]
        ][-3:]
        crowd_mean = (
            quality_weighted_wait(port_reports)
            if port_reports
            else None
        )
        predicted_value, factors = self._normalized_components(
            forecast_value,
            historical_mean,
            crowd_mean,
        )
        sigma = max(
            historical_sigma,
            hourly_slope * TREND_UNCERTAINTY_FACTOR,
            MIN_STANDARD_DEVIATION_MINUTES,
        )
        z_score = NormalDist().inv_cdf(0.5 + CONFIDENCE_LEVEL / 2)
        lower = max(1, round(predicted_value - z_score * sigma))
        upper = round(predicted_value + z_score * sigma)
        wait = max(1, round(predicted_value))
        total_time = access["duration"] + wait + onward["duration"]
        total_cost = access["cost"] + onward["cost"]
        estimated_arrival = scenario_time + timedelta(minutes=total_time)
        latest_departure = target_time - timedelta(
            minutes=total_time + self._safety_buffer_minutes
        )
        buffer_minutes = int((target_time - estimated_arrival).total_seconds() / 60)
        available_border_minutes = (
            (target_time - scenario_time).total_seconds() / 60
            - access["duration"]
            - onward["duration"]
        )
        risk_level, late_risk = self._risk_probability(
            predicted_value,
            sigma,
            available_border_minutes,
        )
        factors.extend(
            [
                {
                    "code": "historical_context",
                    "label": "历史分组",
                    "detail": bucket,
                    "sample_count": sample_count,
                },
                {
                    "code": "uncertainty",
                    "label": "历史波动与趋势",
                    "standard_deviation_minutes": round(sigma, 2),
                    "forecast_slope_minutes_per_hour": round(hourly_slope, 2),
                },
            ]
        )
        if port_reports:
            crowd_factor = next(
                factor for factor in factors if factor["code"] == "crowdsource"
            )
            crowd_factor["average_quality_score"] = round(
                fmean(report["quality_score"] for report in port_reports)
            )
            crowd_factor["detail"] = (
                f"{len(port_reports)}条有效反馈按质量分加权"
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
            "crowdsource_enhanced": bool(port_reports),
            "crowdsource_count": len(port_reports),
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
            "factors": factors,
            "historical_sample_count": sample_count,
            "uncertainty_minutes": round(sigma, 2),
        }

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
        warnings.append("按当前场景时间出发，所有预算内路线均无法准时到达。")
        return max(
            within_budget,
            key=lambda item: (
                item["buffer_minutes"],
                -item["late_risk_percent"],
                -item["total_cost"],
            ),
        ), warnings

    def predict(self, request: PredictionRequest) -> dict:
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

        port_state = self._repository.get_port_state()
        reports = evaluate_reports(
            self._repository.get_reports(),
            port_state,
        )
        scenario_time = datetime.fromisoformat(port_state["timestamp"])
        target_time = self._normalize_target(request.target_time, scenario_time)
        minimum = scenario_time + timedelta(minutes=MIN_TARGET_LEAD_MINUTES)
        maximum = scenario_time + timedelta(hours=MAX_TARGET_HORIZON_HOURS)
        if not minimum <= target_time <= maximum:
            raise DomainValidationError(
                "目标时间超出Demo允许范围",
                code=ErrorCode.TARGET_TIME_OUT_OF_RANGE,
                details={
                    "min_target_time": minimum.isoformat(),
                    "max_target_time": maximum.isoformat(),
                },
            )

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
            "model_version": MODEL_VERSION,
            "confidence_level": CONFIDENCE_LEVEL,
            "demo_notice": "结果由本地可解释统计模型、地点矩阵与持久化众包样本生成，不代表真实口岸状态。",
        }
