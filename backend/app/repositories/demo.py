from copy import deepcopy
from pathlib import Path
import json


def load_json(path: Path) -> dict | list:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


class DemoRepository:
    """Owns deterministic source data and reset-on-restart demo mutations."""

    def __init__(self, data_dir: Path):
        self._port_state = load_json(data_dir / "realtime" / "ports_status.json")
        self._locations = load_json(data_dir / "routes" / "locations.json")
        self._transit_matrix = load_json(data_dir / "routes" / "transit_matrix.json")
        self._reports = list(load_json(data_dir / "crowdsource" / "user_reports.json"))
        self._subscriptions: list[dict] = []

    def get_port_state(self) -> dict:
        return deepcopy(self._port_state)

    def get_locations(self) -> dict:
        return deepcopy(self._locations)

    def find_location(self, location_id: str, kind: str) -> dict | None:
        return next(
            (item for item in self._locations[kind] if item["id"] == location_id),
            None,
        )

    def get_access_leg(self, origin_id: str, port_id: str) -> dict:
        return deepcopy(self._transit_matrix["access"][origin_id][port_id])

    def get_onward_leg(self, port_id: str, destination_id: str) -> dict:
        return deepcopy(self._transit_matrix["onward"][port_id][destination_id])

    def get_reports(self) -> list[dict]:
        return deepcopy(self._reports)

    def add_report(self, report: dict) -> dict:
        self._reports.append(deepcopy(report))
        return deepcopy(report)

    def add_subscription(self, subscription: dict) -> dict:
        self._subscriptions.append(deepcopy(subscription))
        return deepcopy(subscription)

    def subscription_count(self) -> int:
        return len(self._subscriptions)
