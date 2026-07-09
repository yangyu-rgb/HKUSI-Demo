from ..repositories import DemoRepository


class RealtimeService:
    def __init__(self, repository: DemoRepository):
        self._repository = repository

    def get_status(self) -> dict:
        port_state = self._repository.get_port_state()
        reports = self._repository.get_reports()
        return {
            **port_state,
            "ports": [
                {
                    **port,
                    "crowdsource_count": sum(
                        1 for report in reports if report["port"] == port["name"]
                    ),
                }
                for port in port_state["ports"]
            ],
        }
