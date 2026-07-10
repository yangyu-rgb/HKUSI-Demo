from datetime import datetime, timedelta, timezone
from math import ceil

from ..config import REPORT_DUPLICATE_WINDOW_MINUTES
from ..clock import Clock, as_hong_kong
from ..exceptions import ConflictError, DomainValidationError, ErrorCode
from ..repositories import DemoRepository
from ..schemas.crowdsource import CrowdsourceReport
from .report_quality import evaluate_report, public_report
from .wait_forecast import WaitForecastService


class CrowdsourceService:
    def __init__(self, repository: DemoRepository, clock: Clock):
        self._repository = repository
        self._clock = clock
        self._forecast = WaitForecastService(repository, clock)

    def get_feed(self, limit: int) -> dict:
        safe_limit = min(max(limit, 1), 30)
        _snapshot, reports = self._forecast.build_snapshot()
        reports = [
            report
            for report in reports
            if report["_active"]
        ]
        return {
            "reports": [
                public_report(report)
                for report in reversed(reports[-safe_limit:])
            ],
            "total": len(reports),
        }

    def submit(self, report: CrowdsourceReport) -> dict:
        now = as_hong_kong(self._clock.now()).replace(microsecond=0)
        port_state, existing_reports = self._forecast.build_snapshot(now)
        normalized = report.port.strip().lower()
        port = next(
            (
                item
                for item in port_state["ports"]
                if normalized
                in {item["id"], item["name"].lower(), item["name_en"].lower()}
            ),
            None,
        )
        if port is None:
            raise DomainValidationError(
                "不支持该口岸",
                code=ErrorCode.PORT_NOT_FOUND,
                details={"port": report.port},
            )

        forecast_port_id = report.forecast_port_id or port["id"]
        if report.forecast_run_id and self._repository.get_forecast_run_port(
            report.forecast_run_id,
            forecast_port_id,
        ) is None:
            raise DomainValidationError(
                "预测运行不存在，或反馈口岸与预测口岸不匹配",
                details={
                    "forecast_run_id": report.forecast_run_id,
                    "forecast_port_id": forecast_port_id,
                },
            )

        duplicate_age = None
        now_utc = now.astimezone(timezone.utc)
        for item in reversed(existing_reports):
            if item["user_id"] != report.user_id or item["port"] != port["name"]:
                continue
            created_at = datetime.fromisoformat(item["_created_at"])
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            age = max(0.0, (now_utc - created_at).total_seconds() / 60)
            if age < REPORT_DUPLICATE_WINDOW_MINUTES:
                duplicate_age = age
                break
        if duplicate_age is not None:
            retry_after = max(
                1,
                ceil(
                    REPORT_DUPLICATE_WINDOW_MINUTES
                    - duplicate_age
                ),
            )
            raise ConflictError(
                ErrorCode.DUPLICATE_REPORT,
                f"同一口岸反馈提交过于频繁，请在{retry_after}分钟后重试",
                details={"retry_after_minutes": retry_after},
            )

        record = {
            "user_id": report.user_id,
            "port": port["name"],
            "actual_wait_time": report.actual_wait_time,
            "crowd_level": report.crowd_level,
            "timestamp": now.isoformat(),
            "time_label": "刚刚",
            "comment": report.comment or "现场通关反馈",
            "direction": report.direction,
            "channel": report.channel,
            "is_real_observation": report.is_real_observation,
            "training_consent": report.training_consent,
            "source_type": (
                "crowdsource_observation"
                if report.is_real_observation
                else "demo_entry"
            ),
            "wait_started_at": (
                now - timedelta(minutes=report.actual_wait_time)
            ).isoformat(),
            "wait_ended_at": now.isoformat(),
        }
        stored = self._repository.add_report(record)
        evaluated = evaluate_report(stored, port, now)
        record = public_report(evaluated)
        record["eligible_for_v2_label"] = (
            record["used_for_prediction"]
            and record["quality_level"] == "high"
            and record["is_real_observation"]
            and record["training_consent"]
            and bool(report.forecast_run_id)
        )
        forecast_feedback = None
        if report.forecast_run_id:
            if not record["is_real_observation"]:
                label_rejection_reason = "演示反馈已保留关联，但不作为真实训练标签"
            elif not record["training_consent"]:
                label_rejection_reason = "未获得建模同意，已保留关联但不作为训练标签"
            elif not (
                record["used_for_prediction"]
                and record["quality_level"] == "high"
            ):
                label_rejection_reason = "反馈质量不足，已保留关联但不作为训练标签"
            else:
                label_rejection_reason = None
            link = self._repository.link_feedback_to_forecast(
                report_id=record["id"],
                forecast_run_id=report.forecast_run_id,
                port_id=forecast_port_id,
                actual_wait_minutes=record["actual_wait_time"],
                quality_score=record["quality_score"],
                eligible_for_label=record["eligible_for_v2_label"],
                ineligibility_reason=label_rejection_reason,
            )
            assert link is not None
            record["forecast_run_id"] = report.forecast_run_id
            record["forecast_port_id"] = forecast_port_id
            forecast_feedback = {
                "forecast_run_id": report.forecast_run_id,
                "forecast_port_id": forecast_port_id,
                **link,
            }
        points = {
            "high": 10,
            "medium": 6,
            "low": 2,
        }[record["quality_level"]]
        model_updated = (
            record["used_for_prediction"]
            and abs(report.actual_wait_time - port["current_wait"]) > 5
        )
        if record["used_for_prediction"]:
            message = "感谢反馈！你的数据已加入本次演示的预测校准。"
        else:
            message = "反馈已保存，但质量分较低，本次不会用于预测校准。"
        return {
            "success": True,
            "points_earned": points,
            "model_updated": model_updated,
            "report": record,
            "message": message,
            "forecast_feedback": forecast_feedback,
        }
