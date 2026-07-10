"""Persistence and point-in-time queries for governed external features."""

from copy import deepcopy
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from pathlib import Path
import json
import sqlite3

from ..clock import Clock, as_hong_kong
from ..exceptions import PersistenceError


QUEUE_MAX_AGE_MINUTES = 30
TRAFFIC_MAX_AGE_HOURS = 72


class ExternalDataRepository:
    def __init__(self, database_path: Path, clock: Clock, registry: dict):
        self._database_path = database_path
        self._clock = clock
        self._registry = registry

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self._database_path, timeout=5)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA journal_mode = WAL")
        return connection

    def _utc_now(self) -> str:
        return self._clock.now().astimezone(timezone.utc).isoformat()

    def get_registry(self) -> dict:
        return deepcopy(self._registry)

    @staticmethod
    def _changed(existing: sqlite3.Row | None, item: dict) -> bool:
        if existing is None:
            return True
        return any(
            (
                existing["source_version"] != item["source_version"],
                float(existing["raw_value"]) != float(item["raw_value"]),
                existing["congestion_level"] != item["congestion_level"],
                bool(existing["feature_available"]) != bool(item["feature_available"]),
            )
        )

    def save_collection(
        self,
        *,
        source: dict,
        fetched_at: str,
        raw_hash: str,
        archive_path: str,
        observations: list[dict],
    ) -> int:
        try:
            with self._connect() as connection:
                connection.execute(
                    """
                    INSERT OR IGNORE INTO external_collection_runs(
                        source_id, source_version, fetched_at, status, raw_hash,
                        archive_path, observation_count, error, created_at
                    ) VALUES (?, ?, ?, 'success', ?, ?, ?, NULL, ?)
                    """,
                    (
                        source["id"], source["source_version"], fetched_at,
                        raw_hash, archive_path, len(observations), self._utc_now(),
                    ),
                )
                for item in observations:
                    key = (
                        item["source_id"], item["observed_at"], item["port_id"],
                        item["direction"], item["traveler_category"],
                        item["metric_type"],
                    )
                    existing = connection.execute(
                        """
                        SELECT source_version, raw_value, congestion_level,
                               feature_available
                        FROM external_feature_observations
                        WHERE source_id = ? AND observed_at = ? AND port_id = ?
                          AND direction = ? AND traveler_category = ?
                          AND metric_type = ?
                        """,
                        key,
                    ).fetchone()
                    if self._changed(existing, item):
                        connection.execute(
                            """
                            INSERT OR IGNORE INTO external_feature_revisions(
                                source_id, source_version, revision_fetched_at,
                                observed_at, port_id, direction, traveler_category,
                                metric_type, raw_value, congestion_level,
                                feature_available, raw_hash, created_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """,
                            (
                                item["source_id"], item["source_version"],
                                item["fetched_at"], item["observed_at"],
                                item["port_id"], item["direction"],
                                item["traveler_category"], item["metric_type"],
                                item["raw_value"], item["congestion_level"],
                                int(item["feature_available"]), item["raw_hash"],
                                self._utc_now(),
                            ),
                        )
                    connection.execute(
                        """
                        INSERT INTO external_feature_observations(
                            source_id, source_version, fetched_at,
                            first_fetched_at, last_fetched_at, observed_at,
                            port_id, direction, traveler_category, metric_type,
                            raw_value, congestion_level, feature_available,
                            raw_hash, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(
                            source_id, observed_at, port_id, direction,
                            traveler_category, metric_type
                        ) DO UPDATE SET
                            source_version = excluded.source_version,
                            fetched_at = excluded.fetched_at,
                            last_fetched_at = excluded.last_fetched_at,
                            raw_value = excluded.raw_value,
                            congestion_level = excluded.congestion_level,
                            feature_available = excluded.feature_available,
                            raw_hash = excluded.raw_hash,
                            created_at = excluded.created_at
                        """,
                        (
                            item["source_id"], item["source_version"],
                            item["fetched_at"], item["fetched_at"],
                            item["fetched_at"], item["observed_at"], item["port_id"],
                            item["direction"], item["traveler_category"],
                            item["metric_type"], item["raw_value"],
                            item["congestion_level"], int(item["feature_available"]),
                            item["raw_hash"], self._utc_now(),
                        ),
                    )
            return len(observations)
        except sqlite3.Error as error:
            raise PersistenceError() from error

    def record_failure(self, *, source: dict, fetched_at: str, error: str) -> None:
        try:
            with self._connect() as connection:
                connection.execute(
                    """
                    INSERT INTO external_collection_runs(
                        source_id, source_version, fetched_at, status, raw_hash,
                        archive_path, observation_count, error, created_at
                    ) VALUES (?, ?, ?, 'failed', NULL, NULL, 0, ?, ?)
                    """,
                    (source["id"], source["source_version"], fetched_at,
                     error[:500], self._utc_now()),
                )
        except sqlite3.Error as database_error:
            raise PersistenceError() from database_error

    def _latest_revision(
        self,
        connection: sqlite3.Connection,
        *,
        port_id: str,
        direction: str,
        traveler_category: str,
        metric_type: str,
        as_of: datetime,
    ) -> dict | None:
        row = connection.execute(
            """
            SELECT * FROM external_feature_revisions
            WHERE port_id = ? AND direction = ? AND traveler_category = ?
              AND metric_type = ? AND feature_available = 1
              AND revision_fetched_at <= ? AND observed_at <= ?
            ORDER BY observed_at DESC, revision_fetched_at DESC, id DESC
            LIMIT 1
            """,
            (port_id, direction, traveler_category, metric_type,
             as_of.isoformat(), as_of.isoformat()),
        ).fetchone()
        return dict(row) if row else None

    def features_as_of(self, port_id: str, direction: str, as_of: datetime) -> dict:
        moment = as_of.astimezone(timezone.utc)
        try:
            with self._connect() as connection:
                resident = self._latest_revision(
                    connection, port_id=port_id, direction=direction,
                    traveler_category="hong_kong_resident",
                    metric_type="queue_status", as_of=moment,
                )
                visitor = self._latest_revision(
                    connection, port_id=port_id, direction=direction,
                    traveler_category="visitor", metric_type="queue_status",
                    as_of=moment,
                )
                passenger_total = self._latest_revision(
                    connection, port_id=port_id, direction=direction,
                    traveler_category="total", metric_type="passenger_count",
                    as_of=moment,
                )
                passenger_resident = self._latest_revision(
                    connection, port_id=port_id, direction=direction,
                    traveler_category="hong_kong_resident",
                    metric_type="passenger_count", as_of=moment,
                )
        except sqlite3.Error as error:
            raise PersistenceError() from error

        def queue_value(row: dict | None) -> dict:
            if row is None:
                return {"available": False, "reason": "missing"}
            age = (moment - datetime.fromisoformat(row["observed_at"])).total_seconds() / 60
            if age > QUEUE_MAX_AGE_MINUTES:
                return {"available": False, "reason": "stale", "age_minutes": round(age, 2)}
            return {
                "available": True,
                "status_code": int(row["raw_value"]),
                "level": row["congestion_level"],
                "observed_at": row["observed_at"],
                "known_at": row["revision_fetched_at"],
                "age_minutes": round(age, 2),
                "source_version": row["source_version"],
                "raw_hash": row["raw_hash"],
            }

        def traffic_value(total: dict | None, resident: dict | None) -> dict:
            if total is None or resident is None:
                return {"available": False, "reason": "missing"}
            age = (moment - datetime.fromisoformat(total["observed_at"])).total_seconds() / 3600
            if age > TRAFFIC_MAX_AGE_HOURS:
                return {"available": False, "reason": "stale", "age_hours": round(age, 2)}
            return {
                "available": True,
                "total": int(total["raw_value"]),
                "hong_kong_resident": int(resident["raw_value"]),
                "service_date": as_hong_kong(datetime.fromisoformat(total["observed_at"])).date().isoformat(),
                "known_at": total["revision_fetched_at"],
                "age_hours": round(age, 2),
                "source_version": total["source_version"],
                "raw_hash": total["raw_hash"],
            }

        payload = {
            "as_of": moment.isoformat(),
            "resident_queue": queue_value(resident),
            "visitor_queue": queue_value(visitor),
            "passenger_traffic": traffic_value(passenger_total, passenger_resident),
        }
        available = sum(payload[key].get("available", False) for key in (
            "resident_queue", "visitor_queue", "passenger_traffic"
        ))
        payload["status"] = "complete" if available == 3 else "partial" if available else "missing"
        canonical = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        payload["feature_version"] = sha256(canonical.encode()).hexdigest()[:16]
        return payload

    def list_queue_observations(self) -> list[dict]:
        try:
            with self._connect() as connection:
                rows = connection.execute(
                    """
                    SELECT * FROM external_feature_revisions
                    WHERE metric_type = 'queue_status' AND feature_available = 1
                    ORDER BY observed_at ASC, id ASC
                    """
                ).fetchall()
            return [dict(row) for row in rows]
        except sqlite3.Error as error:
            raise PersistenceError() from error

    def readiness(self) -> dict:
        now = self._clock.now().astimezone(timezone.utc)
        window_start = now - timedelta(hours=24)
        try:
            with self._connect() as connection:
                observations = connection.execute(
                    """SELECT source_id, observed_at, port_id, direction,
                              metric_type, feature_available
                       FROM external_feature_observations
                       ORDER BY observed_at ASC, id ASC"""
                ).fetchall()
                runs = connection.execute(
                    """SELECT source_id, fetched_at, status, observation_count
                       FROM external_collection_runs ORDER BY fetched_at ASC, id ASC"""
                ).fetchall()
                forecast_rows = connection.execute(
                    "SELECT features_json FROM forecast_run_ports"
                ).fetchall()
        except sqlite3.Error as error:
            raise PersistenceError() from error

        source_counts: dict[str, int] = {}
        source_runs: dict[str, list[sqlite3.Row]] = {}
        for row in observations:
            source_counts[row["source_id"]] = source_counts.get(row["source_id"], 0) + 1
        for row in runs:
            source_runs.setdefault(row["source_id"], []).append(row)
        available = [row for row in observations if row["feature_available"]]
        queue = [row for row in available if row["metric_type"] == "queue_status"]
        queue_times = [as_hong_kong(datetime.fromisoformat(row["observed_at"])) for row in queue]
        ports: dict[str, int] = {}
        directions: dict[str, int] = {}
        for row in available:
            ports[row["port_id"]] = ports.get(row["port_id"], 0) + 1
            directions[row["direction"]] = directions.get(row["direction"], 0) + 1

        sources = []
        for source in self._registry["sources"]:
            all_runs = source_runs.get(source["id"], [])
            recent_success = [
                row for row in all_runs
                if row["status"] == "success"
                and datetime.fromisoformat(row["fetched_at"]) >= window_start
            ]
            recent_times = sorted(
                datetime.fromisoformat(row["fetched_at"]) for row in recent_success
            )
            boundaries = [window_start, *recent_times, now]
            max_gap_minutes = max(
                (
                    (right - left).total_seconds() / 60
                    for left, right in zip(boundaries, boundaries[1:])
                ),
                default=1440.0,
            )
            successful = [row for row in all_runs if row["status"] == "success"]
            last = datetime.fromisoformat(successful[-1]["fetched_at"]) if successful else None
            age = (now - last).total_seconds() / 60 if last else None
            expected = max(1, int(86400 / source["refresh_seconds"])) if source["collection_enabled"] else 0
            sources.append({
                **source,
                "observation_count": source_counts.get(source["id"], 0),
                "last_fetched_at": last.isoformat() if last else None,
                "age_minutes": round(age, 2) if age is not None else None,
                "freshness_status": (
                    "disabled" if not source["collection_enabled"] else
                    "missing" if age is None else
                    "fresh" if age <= source["refresh_seconds"] * 2 / 60 else "stale"
                ),
                "expected_runs_24h": expected,
                "successful_runs_24h": len(recent_success),
                "completeness_24h_percent": (
                    min(100.0, round(len(recent_success) / expected * 100, 2)) if expected else None
                ),
                "max_gap_minutes_24h": (
                    round(max_gap_minutes, 2) if source["collection_enabled"] else None
                ),
            })

        snapshots = [json.loads(row["features_json"]).get("official_features") for row in forecast_rows]
        complete_snapshots = sum(item is not None and item.get("status") == "complete" for item in snapshots)
        successful_runs = sum(row["status"] == "success" for row in runs)
        return {
            "sources": sources,
            "official_observation_count": len(observations),
            "feature_observation_count": len(available),
            "ports": [{"port_id": key, "observation_count": ports[key]} for key in sorted(ports)],
            "directions": [{"direction": key, "observation_count": directions[key]} for key in sorted(directions)],
            "distinct_dates": len({value.date() for value in queue_times}),
            "hour_slices": len({value.hour for value in queue_times}),
            "last_observed_at": max((row["observed_at"] for row in observations), default=None),
            "collection_runs": len(runs),
            "successful_runs": successful_runs,
            "failed_runs": len(runs) - successful_runs,
            "success_rate_percent": round(successful_runs / len(runs) * 100, 2) if runs else None,
            "forecast_snapshot_total": len(snapshots),
            "forecast_snapshot_complete": complete_snapshots,
            "forecast_snapshot_coverage_percent": round(complete_snapshots / len(snapshots) * 100, 2) if snapshots else None,
            "minute_labels_from_official_features": 0,
        }
