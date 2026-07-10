from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path
import json
import subprocess
import sys

from app.external_data import (
    OfficialDataCollector,
    load_source_registry,
    normalize_daily_traffic,
    normalize_queue_status,
    source_by_id,
    validate_exact_wait_csv,
)
from app.ml.official_alignment import assess_official_alignment
from app.repositories import DemoRepository
from app.schemas.prediction import PredictionRequest
from app.services import PredictionService
from conftest import DATA_DIR, FROZEN_NOW, FrozenClock


QUEUE_PAYLOAD = {
    "LWS": {"arrQueue": 0, "depQueue": 1},
    "LSC": {"arrQueue": 2, "depQueue": 4},
    "LMC": {"arrQueue": 99, "depQueue": 0},
    "SBC": {"arrQueue": 1, "depQueue": 2},
}


def test_snapshot_module_imports_from_a_clean_process() -> None:
    result = subprocess.run(
        [sys.executable, "-c", "from app.ml.snapshot import export_labeled_snapshot"],
        cwd=Path(__file__).resolve().parents[1],
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr


def test_queue_status_normalization_keeps_categories_out_of_minute_labels() -> None:
    registry = load_source_registry(DATA_DIR / "sources" / "official_sources.json")
    source = source_by_id(registry, "hk_immd_queue_resident")
    raw_hash = "a" * 64
    rows = normalize_queue_status(QUEUE_PAYLOAD, source, FROZEN_NOW, raw_hash)

    assert len(rows) == 8
    assert {row["port_id"] for row in rows} == {
        "luohu",
        "futian",
        "huanggang",
        "shenzhen-bay",
    }
    assert {row["direction"] for row in rows} == {
        "hong_kong_to_shenzhen",
        "shenzhen_to_hong_kong",
    }
    assert all(row["metric_type"] == "queue_status" for row in rows)
    assert next(row for row in rows if row["raw_value"] == 4)["feature_available"] is False
    assert next(row for row in rows if row["raw_value"] == 99)["congestion_level"] == "non_service"


def test_daily_traffic_normalization_filters_to_v1_ports() -> None:
    registry = load_source_registry(DATA_DIR / "sources" / "official_sources.json")
    source = source_by_id(registry, "hk_immd_daily_passenger_traffic")
    text = (
        "Date,Control Point,Arrival / Departure,Hong Kong Residents,"
        "Mainland Visitors,Other Visitors,Total,\n"
        "10-07-2026,Lo Wu,Arrival,10,20,30,60,\n"
        "10-07-2026,Airport,Arrival,100,200,300,600,\n"
    )

    rows = normalize_daily_traffic(text, source, FROZEN_NOW, "b" * 64)

    assert len(rows) == 4
    assert {row["port_id"] for row in rows} == {"luohu"}
    assert {row["traveler_category"] for row in rows} == {
        "hong_kong_resident",
        "mainland_visitor",
        "other_visitor",
        "total",
    }
    assert all(row["metric_type"] == "passenger_count" for row in rows)


def test_collector_archives_and_saves_official_features_idempotently(
    tmp_path: Path,
) -> None:
    clock = FrozenClock()
    repository = DemoRepository(DATA_DIR, tmp_path / "external.db", clock)
    registry = repository.get_external_source_registry()
    collector = OfficialDataCollector(
        registry=registry,
        repository=repository.external_data,
        archive_dir=tmp_path / "archive",
        clock=clock.now,
        fetcher=lambda _url: json.dumps(QUEUE_PAYLOAD).encode(),
    )

    first = collector.collect("hk_immd_queue_resident")
    second = collector.collect("hk_immd_queue_resident")
    readiness = repository.external_data.readiness()
    repository.reset_dynamic_data()
    after_reset = repository.external_data.readiness()

    assert first["status"] == second["status"] == "success"
    assert Path(first["archive_path"]).exists()
    assert readiness["official_observation_count"] == 8
    assert readiness["feature_observation_count"] == 6
    assert readiness["collection_runs"] == 1
    assert readiness["minute_labels_from_official_features"] == 0
    assert len(readiness["ports"]) == 4
    assert len(readiness["directions"]) == 2
    assert after_reset["official_observation_count"] == 8


def test_collection_failure_is_audited_without_feature_rows(tmp_path: Path) -> None:
    repository = DemoRepository(DATA_DIR, tmp_path / "failed.db", FrozenClock())
    collector = OfficialDataCollector(
        registry=repository.get_external_source_registry(),
        repository=repository.external_data,
        archive_dir=tmp_path / "archive",
        clock=FrozenClock().now,
        fetcher=lambda _url: (_ for _ in ()).throw(OSError("network unavailable")),
    )

    try:
        collector.collect("hk_immd_queue_resident")
    except OSError:
        pass
    readiness = repository.external_data.readiness()

    assert readiness["official_observation_count"] == 0
    assert readiness["failed_runs"] == 1
    assert readiness["success_rate_percent"] == 0
    resident = next(
        source for source in readiness["sources"]
        if source["id"] == "hk_immd_queue_resident"
    )
    assert resident["freshness_status"] == "missing"
    assert resident["last_fetched_at"] is None


def test_exact_wait_validator_requires_an_approved_label_source() -> None:
    registry = load_source_registry(DATA_DIR / "sources" / "official_sources.json")
    header = (
        "record_id,source_id,source_version,approval_batch_id,port_id,direction,"
        "wait_started_at,wait_ended_at,actual_wait_minutes\n"
    )
    row = (
        "r-1,hk_immd_queue_resident,data-gov-hk-2025-01,batch-1,luohu,hong_kong_to_shenzhen,"
        "2026-07-10T08:00:00+08:00,2026-07-10T08:12:00+08:00,12\n"
    )
    blocked = validate_exact_wait_csv(header + row, registry)

    approved = deepcopy(registry)
    source = source_by_id(approved, "hk_immd_queue_resident")
    source["status"] = "approved_label"
    source["collection_enabled"] = False
    source["approved_label_batches"] = ["batch-1"]
    valid = validate_exact_wait_csv(header + row, approved)

    assert blocked["valid"] is False
    assert "未获准" in blocked["errors"][0]["message"]
    assert valid == {"valid": True, "record_count": 1, "errors": []}


def test_point_in_time_features_use_only_the_revision_known_at_forecast_time(
    tmp_path: Path,
) -> None:
    repository = DemoRepository(DATA_DIR, tmp_path / "point-in-time.db", FrozenClock())
    registry = repository.external_data.get_registry()
    source = source_by_id(registry, "hk_immd_daily_passenger_traffic")
    first_fetch = FROZEN_NOW.astimezone(timezone.utc)
    second_fetch = first_fetch + timedelta(hours=1)
    header = (
        "Date,Control Point,Arrival / Departure,Hong Kong Residents,"
        "Mainland Visitors,Other Visitors,Total,\n"
    )
    first_rows = normalize_daily_traffic(
        header + "10-07-2026,Lo Wu,Departure,10,20,30,60,\n",
        source,
        first_fetch,
        "c" * 64,
    )
    revised_rows = normalize_daily_traffic(
        header + "10-07-2026,Lo Wu,Departure,12,24,36,72,\n",
        source,
        second_fetch,
        "d" * 64,
    )
    repository.external_data.save_collection(
        source=source,
        fetched_at=first_fetch.isoformat(),
        raw_hash="c" * 64,
        archive_path="first.csv",
        observations=first_rows,
    )
    repository.external_data.save_collection(
        source=source,
        fetched_at=second_fetch.isoformat(),
        raw_hash="d" * 64,
        archive_path="second.csv",
        observations=revised_rows,
    )

    before_revision = repository.external_data.features_as_of(
        "luohu",
        "hong_kong_to_shenzhen",
        first_fetch + timedelta(minutes=30),
    )
    after_revision = repository.external_data.features_as_of(
        "luohu",
        "hong_kong_to_shenzhen",
        second_fetch + timedelta(minutes=1),
    )

    assert before_revision["passenger_traffic"]["total"] == 60
    assert after_revision["passenger_traffic"]["total"] == 72
    assert before_revision["resident_queue"]["reason"] == "missing"


def test_prediction_freezes_complete_official_features_without_changing_v1(
    tmp_path: Path,
) -> None:
    clock = FrozenClock()
    repository = DemoRepository(DATA_DIR, tmp_path / "snapshot.db", clock)
    registry = repository.external_data.get_registry()
    fetched_at = FROZEN_NOW.astimezone(timezone.utc)
    for source_id in ("hk_immd_queue_resident", "hk_immd_queue_visitor"):
        source = source_by_id(registry, source_id)
        rows = normalize_queue_status(QUEUE_PAYLOAD, source, fetched_at, source_id * 3)
        repository.external_data.save_collection(
            source=source,
            fetched_at=fetched_at.isoformat(),
            raw_hash=source_id * 3,
            archive_path=f"{source_id}.json",
            observations=rows,
        )
    traffic_source = source_by_id(registry, "hk_immd_daily_passenger_traffic")
    traffic_rows = normalize_daily_traffic(
        "Date,Control Point,Arrival / Departure,Hong Kong Residents,Mainland Visitors,Other Visitors,Total,\n"
        "10-07-2026,Lo Wu,Departure,10,20,30,60,\n",
        traffic_source,
        fetched_at,
        "traffic-hash",
    )
    repository.external_data.save_collection(
        source=traffic_source,
        fetched_at=fetched_at.isoformat(),
        raw_hash="traffic-hash",
        archive_path="traffic.csv",
        observations=traffic_rows,
    )
    result = PredictionService(repository, clock).predict(
        PredictionRequest(
            origin_id="hku",
            destination_id="nanshan-tech",
            target_time=FROZEN_NOW + timedelta(hours=2),
        )
    )
    frozen = repository.get_forecast_run_port(result["forecast_run_id"], "luohu")

    assert result["ports"][0]["predicted_wait_time"] > 0
    assert frozen["features"]["official_features"]["status"] == "complete"
    assert frozen["features"]["official_features"]["passenger_traffic"]["total"] == 60
    assert repository.external_data.readiness()["forecast_snapshot_complete"] == 1


def test_prediction_continues_when_official_feature_query_fails(
    tmp_path: Path,
    monkeypatch,
) -> None:
    clock = FrozenClock()
    repository = DemoRepository(DATA_DIR, tmp_path / "feature-failure.db", clock)

    def fail_query(*_args, **_kwargs):
        raise OSError("external feature store unavailable")

    monkeypatch.setattr(repository.external_data, "features_as_of", fail_query)
    result = PredictionService(repository, clock).predict(
        PredictionRequest(
            origin_id="hku",
            destination_id="nanshan-tech",
            target_time=FROZEN_NOW + timedelta(hours=2),
        )
    )
    frozen = repository.get_forecast_run_port(result["forecast_run_id"], "luohu")

    assert len(result["ports"]) == 4
    assert all(port["predicted_wait_time"] > 0 for port in result["ports"])
    assert frozen["features"]["official_features"]["status"] == "missing"
    assert (
        frozen["features"]["official_features"]["resident_queue"]["reason"]
        == "query_failed"
    )


def test_official_alignment_reports_categories_not_pseudo_minutes(tmp_path: Path) -> None:
    repository = DemoRepository(DATA_DIR, tmp_path / "alignment.db", FrozenClock())
    registry = repository.external_data.get_registry()
    fetched_at = FROZEN_NOW.astimezone(timezone.utc)
    for source_id in ("hk_immd_queue_resident", "hk_immd_queue_visitor"):
        source = source_by_id(registry, source_id)
        rows = normalize_queue_status(QUEUE_PAYLOAD, source, fetched_at, source_id * 3)
        repository.external_data.save_collection(
            source=source,
            fetched_at=fetched_at.isoformat(),
            raw_hash=source_id * 3,
            archive_path=f"{source_id}.json",
            observations=rows,
        )

    report = assess_official_alignment(repository)

    assert report["status"] == "available"
    assert report["sample_count"] == 12
    assert report["metric_type"] == "ordinal_category_only"
    assert "mae" not in report
