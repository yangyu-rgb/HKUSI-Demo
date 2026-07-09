from ..repositories import DemoRepository
from .report_quality import evaluate_reports


class RealtimeService:
    def __init__(self, repository: DemoRepository):
        self._repository = repository

    def get_status(self) -> dict:
        port_state = self._repository.get_port_state()
        reports = evaluate_reports(self._repository.get_reports(), port_state)
        return {
            **port_state,
            "ports": [
                {
                    **port,
                    "crowdsource_count": sum(
                        1 for report in reports if report["port"] == port["name"]
                        and report["used_for_prediction"]
                    ),
                }
                for port in port_state["ports"]
            ],
        }
