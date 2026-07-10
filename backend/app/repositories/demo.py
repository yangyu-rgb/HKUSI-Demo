from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4
import json
import sqlite3
import csv

from ..exceptions import PersistenceError
from ..clock import Clock, HongKongClock
from ..providers import (
    CROWDSOURCE_FALLBACK,
    EVENT_FALLBACK,
    HOLIDAY_FALLBACK,
    PORT_STATE_FALLBACK,
    WEATHER_FALLBACK,
    LocalJsonProvider,
    valid_calendar,
    valid_crowdsource_seed,
    valid_events,
    valid_port_state,
    valid_weather,
)


SCHEMA_VERSION = 5


def load_json(path: Path) -> dict | list:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


class DemoRepository:
    """Combines cached deterministic JSON inputs with transactional SQLite state."""

    def __init__(
        self,
        data_dir: Path,
        database_path: Path,
        clock: Clock | None = None,
    ):
        self._data_dir = data_dir
        self._database_path = database_path
        self._clock = clock or HongKongClock()
        provider_now = self._clock.now()
        self._providers = {
            "port_status": LocalJsonProvider(
                name="port_status",
                path=data_dir / "realtime" / "ports_status.json",
                fallback=PORT_STATE_FALLBACK,
                validator=valid_port_state,
                now=provider_now,
            ),
            "weather": LocalJsonProvider(
                name="weather",
                path=data_dir / "factors" / "weather.json",
                fallback=WEATHER_FALLBACK,
                validator=valid_weather,
                now=provider_now,
            ),
            "calendar": LocalJsonProvider(
                name="calendar",
                path=data_dir / "factors" / "holidays.json",
                fallback=HOLIDAY_FALLBACK,
                validator=valid_calendar,
                now=provider_now,
            ),
            "events": LocalJsonProvider(
                name="events",
                path=data_dir / "factors" / "events.json",
                fallback=EVENT_FALLBACK,
                validator=valid_events,
                now=provider_now,
            ),
            "crowdsource_seed": LocalJsonProvider(
                name="crowdsource_seed",
                path=data_dir / "crowdsource" / "user_reports.json",
                fallback=CROWDSOURCE_FALLBACK,
                validator=valid_crowdsource_seed,
                now=provider_now,
            ),
        }
        self._port_state = self._providers["port_status"].get()
        self._locations = load_json(data_dir / "routes" / "locations.json")
        self._transit_matrix = load_json(data_dir / "routes" / "transit_matrix.json")
        self._history_path = data_dir / "history" / "port_wait_history.csv"
        self._history = self._load_history()
        self._weather = self._providers["weather"].get()
        self._holidays = self._providers["calendar"].get()
        self._events = self._providers["events"].get()
        self._crowdsource_seed = self._providers["crowdsource_seed"].get()
        self._initialize_database()

    def _utc_now(self) -> str:
        return self._clock.now().astimezone(timezone.utc).isoformat()

    def _load_history(self) -> list[dict]:
        with self._history_path.open("r", encoding="utf-8") as file:
            return [
                {
                    **row,
                    "timestamp": datetime.fromisoformat(row["timestamp"]),
                    "wait_minutes": int(row["wait_minutes"]),
                    "is_holiday": row["is_holiday"].lower() == "true",
                }
                for row in csv.DictReader(file)
            ]

    def _connect(self) -> sqlite3.Connection:
        self._database_path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self._database_path, timeout=5)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA journal_mode = WAL")
        return connection

    def _initialize_database(self) -> None:
        try:
            schema = (Path(__file__).with_name("schema.sql")).read_text(encoding="utf-8")
            with self._connect() as connection:
                connection.executescript(schema)
                is_new_database = connection.execute(
                    "SELECT COUNT(*) FROM schema_version"
                ).fetchone()[0] == 0
                connection.execute(
                    "INSERT OR IGNORE INTO schema_version(version, applied_at) VALUES (?, ?)",
                    (SCHEMA_VERSION, self._utc_now()),
                )
                if is_new_database:
                    report_ids = [item["id"] for item in self._crowdsource_seed]
                    subscription_ids = [
                        item["subscription_id"]
                        for item in load_json(
                            self._data_dir / "subscriptions" / "demo_subscriptions.json"
                        )
                    ]
                    connection.executemany(
                        "DELETE FROM crowdsource_reports WHERE id = ?",
                        [(item_id,) for item_id in report_ids],
                    )
                    connection.executemany(
                        "DELETE FROM subscriptions WHERE id = ?",
                        [(item_id,) for item_id in subscription_ids],
                    )
                    self._seed_reports(connection)
                    self._seed_subscriptions(connection)
        except (OSError, sqlite3.Error) as error:
            raise PersistenceError() from error

    def _seed_reports(self, connection: sqlite3.Connection) -> None:
        reports = self._crowdsource_seed
        now = self._clock.now().replace(microsecond=0)
        for report in reports:
            effective_at = now - timedelta(minutes=report["age_minutes"])
            connection.execute(
                """
                INSERT INTO crowdsource_reports(
                    id, user_id, port, actual_wait_time, crowd_level,
                    effective_at, time_label, comment, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    report["id"],
                    report["user_id"],
                    report["port"],
                    report["actual_wait_time"],
                    report["crowd_level"],
                    effective_at.isoformat(),
                    "",
                    report["comment"],
                    effective_at.astimezone(timezone.utc).isoformat(),
                ),
            )

    def _seed_subscriptions(self, connection: sqlite3.Connection) -> None:
        subscriptions = load_json(
            self._data_dir / "subscriptions" / "demo_subscriptions.json"
        )
        for subscription in subscriptions:
            routine = subscription["routine"]
            alerts = subscription["alerts"]
            created_at = self._utc_now()
            connection.execute(
                """
                INSERT INTO subscriptions(
                    id, user_id, origin_id, destination_id, days_json,
                    arrival_deadline, priority, advance_reminder,
                    anomaly_alert, better_route_alert, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    subscription["subscription_id"],
                    subscription["user_id"],
                    routine.get("origin_id", "hku"),
                    routine.get("destination_id", "nanshan-tech"),
                    json.dumps(routine["days"]),
                    routine["arrival_deadline"],
                    routine["priority"],
                    int(alerts["advance_reminder"]),
                    int(alerts["anomaly_alert"]),
                    int(alerts["better_route_alert"]),
                    created_at,
                    created_at,
                ),
            )

    @staticmethod
    def _report_from_row(row: sqlite3.Row) -> dict:
        record = {
            "id": row["id"],
            "user_id": row["user_id"],
            "port": row["port"],
            "actual_wait_time": row["actual_wait_time"],
            "crowd_level": row["crowd_level"],
            "timestamp": row["effective_at"],
            "time_label": row["time_label"],
            "comment": row["comment"],
            "_created_at": row["created_at"],
        }
        if "forecast_run_id" in row.keys():
            record["forecast_run_id"] = row["forecast_run_id"]
            record["forecast_port_id"] = row["forecast_port_id"]
        return record

    @staticmethod
    def _subscription_from_row(row: sqlite3.Row) -> dict:
        return {
            "subscription_id": row["id"],
            "user_id": row["user_id"],
            "routine": {
                "origin_id": row["origin_id"],
                "destination_id": row["destination_id"],
                "days": json.loads(row["days_json"]),
                "arrival_deadline": row["arrival_deadline"],
                "priority": row["priority"],
            },
            "alerts": {
                "advance_reminder": bool(row["advance_reminder"]),
                "anomaly_alert": bool(row["anomaly_alert"]),
                "better_route_alert": bool(row["better_route_alert"]),
            },
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }

    @staticmethod
    def _subscription_evaluation_from_row(row: sqlite3.Row) -> dict:
        return {
            "evaluation_id": row["id"],
            "subscription_id": row["subscription_id"],
            "evaluated_at": row["evaluated_at"],
            "evaluation_time": row["evaluation_time"],
            "commute_date": row["commute_date"],
            "target_time": row["target_time"],
            "recommended_port": row["recommended_port"],
            "recommended_port_id": row["recommended_port_id"],
            "latest_departure": row["latest_departure"],
            "next_alert": row["next_alert"],
            "alternative_port": row["alternative_port"],
            "alerts": json.loads(row["alerts_json"]),
            "warnings": json.loads(row["warnings_json"]),
            "is_read": bool(row["is_read"]),
            "read_at": row["read_at"],
            "created_at": row["created_at"],
        }

    def get_port_state(self) -> dict:
        return deepcopy(self._port_state)

    def get_locations(self) -> dict:
        return deepcopy(self._locations)

    def get_weather(self) -> dict:
        return deepcopy(self._weather)

    def get_holidays(self) -> dict:
        return deepcopy(self._holidays)

    def get_events(self) -> dict:
        return deepcopy(self._events)

    def get_provider_statuses(self) -> list[dict]:
        return [
            {
                **provider.status(),
                "data_version": provider.version(),
            }
            for provider in self._providers.values()
        ]

    def get_prediction_input_context(self, target_time: datetime) -> dict:
        weather_condition = self._weather["condition"]
        return {
            "weather": (
                "rain"
                if "rain" in weather_condition or "thunder" in weather_condition
                else "clear"
            ),
            "is_holiday": target_time.date().isoformat()
            in set(self._holidays["dates"]),
            "data_sources": self.get_provider_statuses(),
            "data_version": "-".join(
                item["data_version"]
                for item in self.get_provider_statuses()
            ),
        }

    def get_history_path(self) -> Path:
        return self._history_path

    def get_history(self, port_name: str) -> list[dict]:
        return [
            deepcopy(record)
            for record in self._history
            if record["port"] == port_name
        ]

    def find_location(self, location_id: str, kind: str) -> dict | None:
        return next(
            (item for item in self._locations[kind] if item["id"] == location_id),
            None,
        )

    def get_access_leg(self, origin_id: str, port_id: str) -> dict:
        return deepcopy(self._transit_matrix["access"][origin_id][port_id])

    def get_onward_leg(self, port_id: str, destination_id: str) -> dict:
        return deepcopy(self._transit_matrix["onward"][port_id][destination_id])

    def get_reports(self, limit: int | None = None) -> list[dict]:
        query = """
            SELECT reports.*, links.forecast_run_id,
                   links.port_id AS forecast_port_id
            FROM crowdsource_reports AS reports
            LEFT JOIN forecast_feedback_links AS links ON links.report_id = reports.id
            ORDER BY reports.created_at ASC, reports.id ASC
        """
        parameters: tuple = ()
        if limit is not None:
            query = """
                SELECT * FROM (
                    SELECT reports.*, links.forecast_run_id,
                           links.port_id AS forecast_port_id
                    FROM crowdsource_reports AS reports
                    LEFT JOIN forecast_feedback_links AS links ON links.report_id = reports.id
                    ORDER BY created_at DESC, id DESC LIMIT ?
                ) ORDER BY created_at ASC, id ASC
            """
            parameters = (limit,)
        try:
            with self._connect() as connection:
                rows = connection.execute(query, parameters).fetchall()
            return [self._report_from_row(row) for row in rows]
        except sqlite3.Error as error:
            raise PersistenceError() from error

    def add_report(self, report: dict) -> dict:
        record = {
            **report,
            "id": report.get("id", f"report-{uuid4().hex[:12]}"),
            "_created_at": self._utc_now(),
        }
        try:
            with self._connect() as connection:
                connection.execute(
                    """
                    INSERT INTO crowdsource_reports(
                        id, user_id, port, actual_wait_time, crowd_level,
                        effective_at, time_label, comment, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        record["id"],
                        record["user_id"],
                        record["port"],
                        record["actual_wait_time"],
                        record["crowd_level"],
                        record["timestamp"],
                        record["time_label"],
                        record["comment"],
                        record["_created_at"],
                    ),
                )
            return deepcopy(record)
        except sqlite3.Error as error:
            raise PersistenceError() from error

    def list_subscriptions(self, user_id: str) -> list[dict]:
        try:
            with self._connect() as connection:
                rows = connection.execute(
                    """
                    SELECT * FROM subscriptions
                    WHERE user_id = ? ORDER BY created_at DESC, id DESC
                    """,
                    (user_id,),
                ).fetchall()
            return [self._subscription_from_row(row) for row in rows]
        except sqlite3.Error as error:
            raise PersistenceError() from error

    def get_subscription(self, subscription_id: str) -> dict | None:
        try:
            with self._connect() as connection:
                row = connection.execute(
                    "SELECT * FROM subscriptions WHERE id = ?",
                    (subscription_id,),
                ).fetchone()
            return self._subscription_from_row(row) if row else None
        except sqlite3.Error as error:
            raise PersistenceError() from error

    def add_subscription(self, subscription: dict) -> dict:
        record = {
            **subscription,
            "subscription_id": subscription.get(
                "subscription_id",
                f"sub-{uuid4().hex[:12]}",
            ),
            "created_at": self._utc_now(),
            "updated_at": self._utc_now(),
        }
        routine = record["routine"]
        alerts = record["alerts"]
        try:
            with self._connect() as connection:
                connection.execute(
                    """
                    INSERT INTO subscriptions(
                        id, user_id, origin_id, destination_id, days_json,
                        arrival_deadline, priority, advance_reminder,
                        anomaly_alert, better_route_alert, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        record["subscription_id"],
                        record["user_id"],
                        routine["origin_id"],
                        routine["destination_id"],
                        json.dumps(routine["days"]),
                        routine["arrival_deadline"],
                        routine["priority"],
                        int(alerts["advance_reminder"]),
                        int(alerts["anomaly_alert"]),
                        int(alerts["better_route_alert"]),
                        record["created_at"],
                        record["updated_at"],
                    ),
                )
            return deepcopy(record)
        except sqlite3.Error as error:
            raise PersistenceError() from error

    def update_subscription(self, subscription_id: str, subscription: dict) -> dict | None:
        routine = subscription["routine"]
        alerts = subscription["alerts"]
        updated_at = self._utc_now()
        try:
            with self._connect() as connection:
                cursor = connection.execute(
                    """
                    UPDATE subscriptions SET
                        origin_id = ?, destination_id = ?, days_json = ?,
                        arrival_deadline = ?, priority = ?,
                        advance_reminder = ?, anomaly_alert = ?,
                        better_route_alert = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (
                        routine["origin_id"],
                        routine["destination_id"],
                        json.dumps(routine["days"]),
                        routine["arrival_deadline"],
                        routine["priority"],
                        int(alerts["advance_reminder"]),
                        int(alerts["anomaly_alert"]),
                        int(alerts["better_route_alert"]),
                        updated_at,
                        subscription_id,
                    ),
                )
                if cursor.rowcount == 0:
                    return None
            return self.get_subscription(subscription_id)
        except sqlite3.Error as error:
            raise PersistenceError() from error

    def delete_subscription(self, subscription_id: str) -> bool:
        try:
            with self._connect() as connection:
                cursor = connection.execute(
                    "DELETE FROM subscriptions WHERE id = ?",
                    (subscription_id,),
                )
            return cursor.rowcount > 0
        except sqlite3.Error as error:
            raise PersistenceError() from error

    def save_subscription_evaluation(self, evaluation: dict) -> dict:
        record = {
            **evaluation,
            "evaluation_id": f"eval-{uuid4().hex[:12]}",
            "is_read": False,
            "read_at": None,
            "created_at": self._utc_now(),
        }
        try:
            with self._connect() as connection:
                connection.execute(
                    """
                    INSERT INTO subscription_evaluations(
                        id, subscription_id, evaluated_at, evaluation_time,
                        commute_date, target_time, recommended_port,
                        recommended_port_id, latest_departure, next_alert,
                        alternative_port, alerts_json, warnings_json, is_read,
                        read_at, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        record["evaluation_id"],
                        record["subscription_id"],
                        record["evaluated_at"].isoformat(),
                        record["evaluation_time"].isoformat(),
                        record["commute_date"].isoformat(),
                        record["target_time"].isoformat(),
                        record["recommended_port"],
                        record["recommended_port_id"],
                        record["latest_departure"].isoformat(),
                        record["next_alert"].isoformat()
                        if record["next_alert"]
                        else None,
                        record["alternative_port"],
                        json.dumps(record["alerts"], ensure_ascii=False, default=str),
                        json.dumps(record["warnings"], ensure_ascii=False),
                        0,
                        None,
                        record["created_at"],
                    ),
                )
            return self.get_subscription_evaluation(record["evaluation_id"])
        except sqlite3.Error as error:
            raise PersistenceError() from error

    def get_subscription_evaluation(self, evaluation_id: str) -> dict | None:
        try:
            with self._connect() as connection:
                row = connection.execute(
                    "SELECT * FROM subscription_evaluations WHERE id = ?",
                    (evaluation_id,),
                ).fetchone()
            return self._subscription_evaluation_from_row(row) if row else None
        except sqlite3.Error as error:
            raise PersistenceError() from error

    def list_subscription_evaluations(
        self,
        subscription_id: str,
        limit: int,
    ) -> list[dict]:
        try:
            with self._connect() as connection:
                rows = connection.execute(
                    """
                    SELECT * FROM subscription_evaluations
                    WHERE subscription_id = ?
                    ORDER BY evaluated_at DESC, id DESC LIMIT ?
                    """,
                    (subscription_id, limit),
                ).fetchall()
            return [self._subscription_evaluation_from_row(row) for row in rows]
        except sqlite3.Error as error:
            raise PersistenceError() from error

    def mark_subscription_evaluation_read(self, evaluation_id: str) -> dict | None:
        try:
            with self._connect() as connection:
                cursor = connection.execute(
                    """
                    UPDATE subscription_evaluations
                    SET is_read = 1, read_at = COALESCE(read_at, ?)
                    WHERE id = ?
                    """,
                    (self._utc_now(), evaluation_id),
                )
                if cursor.rowcount == 0:
                    return None
            return self.get_subscription_evaluation(evaluation_id)
        except sqlite3.Error as error:
            raise PersistenceError() from error

    def save_batch_plan(self, company: str, service_date: str, request: dict, result: dict) -> str:
        plan_id = f"plan-{uuid4().hex[:12]}"
        try:
            with self._connect() as connection:
                connection.execute(
                    """
                    INSERT INTO batch_plans(
                        id, company, service_date, request_json, result_json, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        plan_id,
                        company,
                        service_date,
                        json.dumps(request, ensure_ascii=False),
                        json.dumps(result, ensure_ascii=False),
                        self._utc_now(),
                    ),
                )
            return plan_id
        except sqlite3.Error as error:
            raise PersistenceError() from error

    def list_batch_plans(self, company: str, limit: int) -> list[dict]:
        try:
            with self._connect() as connection:
                rows = connection.execute(
                    """
                    SELECT * FROM batch_plans
                    WHERE company = ?
                    ORDER BY created_at DESC LIMIT ?
                    """,
                    (company, limit),
                ).fetchall()
            return [
                {
                    "plan_id": row["id"],
                    "company": row["company"],
                    "date": row["service_date"],
                    "request": json.loads(row["request_json"]),
                    "result": json.loads(row["result_json"]),
                    "created_at": row["created_at"],
                }
                for row in rows
            ]
        except sqlite3.Error as error:
            raise PersistenceError() from error

    def save_shadow_observations(self, observations: list[dict]) -> None:
        if not observations:
            return
        try:
            with self._connect() as connection:
                connection.executemany(
                    """
                    INSERT INTO shadow_model_observations(
                        generated_at, target_time, port_id, port_name,
                        statistical_wait_minutes, shadow_wait_minutes,
                        difference_minutes, status, model_version, reason
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    [
                        (
                            observation["generated_at"],
                            observation["target_time"],
                            observation["port_id"],
                            observation["port_name"],
                            observation["statistical_wait_minutes"],
                            observation["shadow_wait_minutes"],
                            observation["difference_minutes"],
                            observation["status"],
                            observation["model_version"],
                            observation["reason"],
                        )
                        for observation in observations
                    ],
                )
        except sqlite3.Error as error:
            raise PersistenceError() from error

    def save_forecast_run(self, run: dict, ports: list[dict]) -> None:
        try:
            with self._connect() as connection:
                connection.execute(
                    """
                    INSERT OR IGNORE INTO forecast_runs(
                        id, generated_at, target_time, query_json, model_version,
                        data_version, data_sources_json, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        run["id"],
                        run["generated_at"],
                        run["target_time"],
                        json.dumps(run["query"], ensure_ascii=False, default=str),
                        run["model_version"],
                        run["data_version"],
                        json.dumps(run["data_sources"], ensure_ascii=False),
                        self._utc_now(),
                    ),
                )
                connection.executemany(
                    """
                    INSERT OR IGNORE INTO forecast_run_ports(
                        forecast_run_id, port_id, port_name, target_time,
                        statistical_wait_minutes, shadow_wait_minutes,
                        shadow_status, shadow_reason, features_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    [
                        (
                            run["id"],
                            port["port_id"],
                            port["port_name"],
                            run["target_time"],
                            port["statistical_wait_minutes"],
                            port["shadow_wait_minutes"],
                            port["shadow_status"],
                            port["shadow_reason"],
                            json.dumps(port["features"], ensure_ascii=False),
                        )
                        for port in ports
                    ],
                )
        except sqlite3.Error as error:
            raise PersistenceError() from error

    def get_forecast_run_port(self, forecast_run_id: str, port_id: str) -> dict | None:
        try:
            with self._connect() as connection:
                row = connection.execute(
                    """
                    SELECT forecast_run_id, port_id, port_name, target_time,
                           statistical_wait_minutes, shadow_wait_minutes,
                           shadow_status, shadow_reason, features_json,
                           observed_wait_minutes, observed_report_id, observed_at,
                           observed_quality_score, label_status
                    FROM forecast_run_ports
                    WHERE forecast_run_id = ? AND port_id = ?
                    """,
                    (forecast_run_id, port_id),
                ).fetchone()
            if row is None:
                return None
            record = dict(row)
            record["features"] = json.loads(record.pop("features_json"))
            return record
        except sqlite3.Error as error:
            raise PersistenceError() from error

    def link_feedback_to_forecast(
        self,
        *,
        report_id: str,
        forecast_run_id: str,
        port_id: str,
        actual_wait_minutes: int,
        quality_score: int,
        eligible_for_label: bool,
    ) -> dict | None:
        """Link feedback to a forecast, and label it only when quality is high."""
        try:
            with self._connect() as connection:
                run_port = connection.execute(
                    """
                    SELECT observed_report_id FROM forecast_run_ports
                    WHERE forecast_run_id = ? AND port_id = ?
                    """,
                    (forecast_run_id, port_id),
                ).fetchone()
                if run_port is None:
                    return None
                existing_link = connection.execute(
                    """
                    SELECT report_id FROM forecast_feedback_links
                    WHERE report_id = ?
                    """,
                    (report_id,),
                ).fetchone()
                if existing_link is not None:
                    return {"linked": False, "labeled": False, "reason": "反馈已关联预测"}
                connection.execute(
                    """
                    INSERT INTO forecast_feedback_links(
                        report_id, forecast_run_id, port_id, linked_at
                    ) VALUES (?, ?, ?, ?)
                    """,
                    (report_id, forecast_run_id, port_id, self._utc_now()),
                )
                if not eligible_for_label:
                    return {
                        "linked": True,
                        "labeled": False,
                        "reason": "反馈质量不足，已保留关联但不作为训练标签",
                    }
                if run_port["observed_report_id"] is not None:
                    return {
                        "linked": True,
                        "labeled": False,
                        "reason": "该预测已有高质量实际等待标签",
                    }
                connection.execute(
                    """
                    UPDATE forecast_run_ports
                    SET observed_wait_minutes = ?, observed_report_id = ?,
                        observed_at = ?, observed_quality_score = ?,
                        label_status = 'labeled'
                    WHERE forecast_run_id = ? AND port_id = ?
                    """,
                    (
                        actual_wait_minutes,
                        report_id,
                        self._utc_now(),
                        quality_score,
                        forecast_run_id,
                        port_id,
                    ),
                )
                return {"linked": True, "labeled": True, "reason": None}
        except sqlite3.Error as error:
            raise PersistenceError() from error

    def list_labeled_forecast_rows(self) -> list[dict]:
        try:
            with self._connect() as connection:
                rows = connection.execute(
                    """
                    SELECT runs.id AS forecast_run_id, runs.generated_at,
                           runs.target_time AS run_target_time, runs.model_version,
                           runs.data_version, ports.port_id, ports.port_name,
                           ports.statistical_wait_minutes, ports.shadow_wait_minutes,
                           ports.shadow_status, ports.features_json,
                           ports.observed_wait_minutes, ports.observed_report_id,
                           ports.observed_at, ports.observed_quality_score
                    FROM forecast_run_ports AS ports
                    JOIN forecast_runs AS runs ON runs.id = ports.forecast_run_id
                    WHERE ports.label_status = 'labeled'
                    ORDER BY ports.observed_at ASC, runs.id ASC, ports.port_id ASC
                    """
                ).fetchall()
            return [
                {
                    **dict(row),
                    "features": json.loads(row["features_json"]),
                }
                for row in rows
            ]
        except sqlite3.Error as error:
            raise PersistenceError() from error

    def list_shadow_observations(self, limit: int = 100) -> list[dict]:
        try:
            with self._connect() as connection:
                rows = connection.execute(
                    """
                    SELECT * FROM shadow_model_observations
                    ORDER BY id DESC LIMIT ?
                    """,
                    (limit,),
                ).fetchall()
            return [dict(row) for row in rows]
        except sqlite3.Error as error:
            raise PersistenceError() from error

    def get_shadow_observation_summary(self) -> dict:
        try:
            with self._connect() as connection:
                rows = connection.execute(
                    """
                    SELECT generated_at, port_id, port_name, shadow_wait_minutes,
                           difference_minutes, status
                    FROM shadow_model_observations
                    ORDER BY generated_at DESC, id DESC
                    """
                ).fetchall()
        except sqlite3.Error as error:
            raise PersistenceError() from error

        by_port: dict[str, dict] = {}
        for row in rows:
            item = by_port.setdefault(
                row["port_id"],
                {
                    "port_id": row["port_id"],
                    "port_name": row["port_name"],
                    "observation_count": 0,
                    "differences": [],
                },
            )
            item["observation_count"] += 1
            if row["shadow_wait_minutes"] is not None:
                item["differences"].append(float(row["difference_minutes"]))

        ports = []
        for item in sorted(by_port.values(), key=lambda value: value["port_id"]):
            differences = item.pop("differences")
            ports.append(
                {
                    **item,
                    "average_difference_minutes": (
                        round(sum(differences) / len(differences), 2)
                        if differences
                        else None
                    ),
                    "average_absolute_difference_minutes": (
                        round(
                            sum(abs(value) for value in differences) / len(differences),
                            2,
                        )
                        if differences
                        else None
                    ),
                }
            )
        return {
            "total_observations": len(rows),
            "available_observations": sum(
                row["status"] == "available" for row in rows
            ),
            "unavailable_observations": sum(
                row["status"] != "available" for row in rows
            ),
            "latest_observed_at": rows[0]["generated_at"] if rows else None,
            "ports": ports,
        }

    def reset_dynamic_data(self) -> dict:
        try:
            with self._connect() as connection:
                connection.execute("DELETE FROM forecast_feedback_links")
                connection.execute("DELETE FROM forecast_run_ports")
                connection.execute("DELETE FROM forecast_runs")
                connection.execute("DELETE FROM subscription_evaluations")
                connection.execute("DELETE FROM crowdsource_reports")
                connection.execute("DELETE FROM subscriptions")
                connection.execute("DELETE FROM batch_plans")
                connection.execute("DELETE FROM shadow_model_observations")
                self._seed_reports(connection)
                self._seed_subscriptions(connection)
            return {
                "reports": len(self.get_reports()),
                "subscriptions": len(self.list_subscriptions("demo-user")),
                "batch_plans": 0,
            }
        except sqlite3.Error as error:
            raise PersistenceError() from error
