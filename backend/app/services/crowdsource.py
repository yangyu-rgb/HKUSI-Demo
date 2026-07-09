from ..exceptions import DomainValidationError, ErrorCode
from ..repositories import DemoRepository
from ..schemas.crowdsource import CrowdsourceReport


class CrowdsourceService:
    def __init__(self, repository: DemoRepository):
        self._repository = repository

    def get_feed(self, limit: int) -> dict:
        safe_limit = min(max(limit, 1), 30)
        reports = self._repository.get_reports()
        return {"reports": list(reversed(reports[-safe_limit:])), "total": len(reports)}

    def submit(self, report: CrowdsourceReport) -> dict:
        port_state = self._repository.get_port_state()
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

        model_updated = abs(report.actual_wait_time - port["current_wait"]) > 5
        record = {
            "user_id": report.user_id,
            "port": port["name"],
            "actual_wait_time": report.actual_wait_time,
            "crowd_level": report.crowd_level,
            "timestamp": port_state["timestamp"],
            "time_label": "刚刚",
            "comment": report.comment or "现场通关反馈",
        }
        record = self._repository.add_report(record)
        return {
            "success": True,
            "points_earned": 10,
            "model_updated": model_updated,
            "report": record,
            "message": "感谢反馈！你的数据已加入本次演示的预测校准。",
        }
