from datetime import timedelta

from ..clock import Clock, HONG_KONG_TIMEZONE, as_hong_kong, ceil_minutes
from ..calibration import CALIBRATION_POLICY
from ..config import (
    MAX_TARGET_HORIZON_HOURS,
    MIN_TARGET_LEAD_MINUTES,
    REALTIME_POLL_INTERVAL_SECONDS,
)
from ..repositories import DemoRepository
from ..ml.shadow import ShadowWaitModel
from ..ml.scenario_model import ScenarioWaitModel
from .wait_forecast import WaitForecastService


class DemoService:
    def __init__(
        self,
        repository: DemoRepository,
        clock: Clock,
        shadow_model: ShadowWaitModel | None = None,
        scenario_model: ScenarioWaitModel | None = None,
    ):
        self._repository = repository
        self._clock = clock
        self._shadow_model = shadow_model
        self._scenario_model = scenario_model

    def get_context(self) -> dict:
        current_time = as_hong_kong(self._clock.now()).replace(microsecond=0)
        return {
            "current_time": current_time,
            "timezone": HONG_KONG_TIMEZONE,
            "min_target_time": ceil_minutes(
                current_time + timedelta(minutes=MIN_TARGET_LEAD_MINUTES),
                1,
            ),
            "suggested_target_time": ceil_minutes(
                current_time + timedelta(hours=2),
                15,
            ),
            "max_target_time": current_time + timedelta(hours=MAX_TARGET_HORIZON_HOURS),
            "poll_interval_seconds": REALTIME_POLL_INTERVAL_SECONDS,
        }

    def get_personas(self) -> dict:
        return self._repository.get_personas()

    def get_v1_model(self) -> dict:
        metadata = self._repository.get_v1_model_metadata()
        status = self._shadow_model.status if self._shadow_model else None
        return {
            "artifact_available": bool(status and status.available),
            "unavailable_reason": status.reason if status else "model_not_initialized",
            "model_version": metadata["model_version"],
            "synthetic_only": metadata["synthetic_only"],
            "dataset": metadata["dataset"],
            "split": metadata["split"],
            "metrics": metadata["metrics"],
            "features": metadata["features"],
            "promotion": metadata["promotion"],
            "limitations": [
                "所有指标仅用于合成数据工程参考。",
                "AI v1 只进行影子计算，不改变用户推荐。",
            ],
        }

    def get_v1_readiness(self) -> dict:
        route_errors = self._repository.get_route_validation_errors()
        provider_statuses = self._repository.get_provider_statuses()
        providers_ready = all(item["status"] == "available" for item in provider_statuses)
        personas = self._repository.get_personas()["personas"]
        status = self._shadow_model.status if self._shadow_model else None
        v2_status = self._scenario_model.status if self._scenario_model else None
        checks = [
            {
                "name": "双向地点与交通矩阵",
                "passed": not route_errors,
                "detail": "完整" if not route_errors else "；".join(route_errors),
            },
            {
                "name": "本地 Provider",
                "passed": providers_ready,
                "detail": f"{sum(item['status'] == 'available' for item in provider_statuses)}/{len(provider_statuses)} 可用",
            },
            {
                "name": "SQLite",
                "passed": self._repository.database_ready(),
                "detail": "Schema 可读取",
            },
            {
                "name": "Demo persona",
                "passed": len(personas) >= 3,
                "detail": f"{len(personas)} 个本地身份",
            },
            {
                "name": "AI v1 影子产物",
                "passed": bool(status and status.available),
                "detail": (
                    status.model_version
                    if status and status.available
                    else (status.reason if status else "未初始化")
                ),
            },
            {
                "name": "AI v2 场景产物",
                "passed": bool(v2_status and v2_status.available),
                "detail": v2_status.model_version if v2_status and v2_status.available else (v2_status.reason if v2_status else "未初始化"),
            },
            {
                "name": "本地通知适配器",
                "passed": True,
                "detail": "SQLite inbox",
            },
        ]
        return {
            "demo_ready": all(item["passed"] for item in checks),
            "checks": checks,
            "adapter_modes": {
                "database": "sqlite-local",
                "notifications": "sqlite-inbox",
                "queue": "synchronous-demo",
                "cache": "process-local",
                "identity": "demo-persona",
            },
        }

    def get_v2_model(self) -> dict:
        metadata = self._repository.get_v2_model_metadata()
        status = self._scenario_model.status if self._scenario_model else None
        return {
            "artifact_available": bool(status and status.available),
            "unavailable_reason": status.reason if status else "model_not_initialized",
            "model_version": metadata["model_version"],
            "synthetic_only": metadata["synthetic_only"],
            "evaluation_scope": metadata["evaluation_scope"],
            "dataset": metadata["dataset"],
            "split": metadata["split"],
            "metrics": metadata["metrics"],
            "features": metadata["features"],
            "limitations": metadata["limitations"],
            "target_scope": metadata.get("target_scope", "synthetic_target"),
            "real_feature_sources": metadata.get("real_feature_sources", []),
            "calibration_version": CALIBRATION_POLICY.version,
            "source_snapshot": metadata["source_snapshot"],
            "data_audit": metadata["data_audit"],
            "formula": metadata["formula"],
            "selection": metadata["selection"],
            "candidate_leaderboard": metadata["candidate_leaderboard"],
            "interval_calibration": metadata["interval_calibration"],
            "traffic_distribution": metadata["traffic_distribution"],
            "sensitivity": metadata["sensitivity"],
            "promotion": metadata["promotion"],
            "optimization_matrix": [
                {"id": "candidate_selection", "name": "多模型候选选型", "status": "completed", "evidence": f"Ridge、ExtraTrees 与 HGB 共 {metadata['selection']['candidate_count']} 组候选，验证集选型"},
                {"id": "shadow_ab", "name": "运行时模型 A/B", "status": "completed", "evidence": "AI v1 影子对照与 AI v2.2 主预测同时记录，不影响用户结果"},
                {"id": "scenario_ab", "name": "未来场景 A/B", "status": "completed", "evidence": "默认场景与草稿场景无副作用对比"},
                {"id": "explainability", "name": "模型可解释性", "status": "completed", "evidence": "客流消融、单调敏感性、逐层透明校准和最终因子链"},
                {"id": "online_learning", "name": "在线学习", "status": "blocked", "evidence": "缺少合规真实等待分钟标签；课堂众包禁止进入训练"},
                {"id": "shap", "name": "SHAP 逐预测解释", "status": "deferred", "evidence": "当前透明因子与消融已满足 Demo；取得真实标签后再评估 SHAP"},
                {"id": "runtime_ensemble", "name": "运行时模型集成", "status": "deferred", "evidence": "当前候选差异未证明集成优于单模型，先保留统计降级与影子对照"},
            ],
        }

    def get_audit_events(self, limit: int) -> dict:
        events = self._repository.list_audit_events(limit)
        return {"events": events, "total": len(events)}

    def get_operations_summary(self, window_hours: int) -> dict:
        now = as_hong_kong(self._clock.now()).replace(microsecond=0)
        stored = self._repository.get_operations_summary(window_hours, now)
        _snapshot, reports = WaitForecastService(self._repository, self._clock).build_snapshot(now)
        active = [report for report in reports if report["_active"]]
        usable = [report for report in active if report["used_for_prediction"]]
        quality_counts = {"high": 0, "medium": 0, "low": 0}
        for report in active:
            quality_counts[report["quality_level"]] += 1
        stored.update({
            "generated_at": now,
            "window_hours": window_hours,
            "crowdsource": {
                "active_reports": len(active),
                "used_for_prediction": len(usable),
                "distinct_reporters": len({report["user_id"] for report in usable}),
                "average_quality_score": (
                    round(sum(report["quality_score"] for report in active) / len(active), 1)
                    if active else None
                ),
                "quality_counts": quality_counts,
                "linked_feedback_count": stored.pop("linked_feedback_count"),
            },
            "adapters": {
                "database": "sqlite-local",
                "database_ready": self._repository.database_ready(),
                "providers": self._repository.get_provider_statuses(),
                "identity": "demo-persona",
                "notifications": "sqlite-inbox",
            },
        })
        return stored

    def reset(self) -> dict:
        return {
            "success": True,
            "seeded": self._repository.reset_dynamic_data(),
            "message": "Demo 数据已按当前香港时间恢复为初始状态。",
        }

    def get_model_shadow_summary(self) -> dict:
        return self._repository.get_shadow_observation_summary()
