from datetime import datetime
from pathlib import Path
import json

from conftest import FROZEN_NOW, FrozenClock
from app.repositories import DemoRepository
from app.providers import LocalJsonProvider, WEATHER_FALLBACK, has_keys
from app.ml.snapshot import export_labeled_snapshot


DATA_DIR = Path(__file__).resolve().parents[2] / "data"


def test_dynamic_data_persists_across_repository_instances(tmp_path: Path) -> None:
    database = tmp_path / "persistent.db"
    first = DemoRepository(DATA_DIR, database)
    first.add_report(
        {
            "user_id": "persist-user",
            "port": "福田",
            "actual_wait_time": 9,
            "crowd_level": "low",
            "timestamp": "2026-07-09T07:45:00",
            "time_label": "刚刚",
            "comment": "持久化测试",
        }
    )

    second = DemoRepository(DATA_DIR, database)
    assert any(
        report["user_id"] == "persist-user"
        for report in second.get_reports()
    )


def test_reset_restores_seed_data(tmp_path: Path) -> None:
    repository = DemoRepository(DATA_DIR, tmp_path / "reset.db")
    repository.add_report(
        {
            "user_id": "temporary",
            "port": "罗湖",
            "actual_wait_time": 30,
            "crowd_level": "high",
            "timestamp": "2026-07-09T07:45:00",
            "time_label": "刚刚",
            "comment": "应被重置",
        }
    )

    seeded = repository.reset_dynamic_data()
    assert seeded == {"reports": 4, "subscriptions": 1, "batch_plans": 0}
    assert not any(
        report["user_id"] == "temporary"
        for report in repository.get_reports()
    )


def test_empty_dynamic_table_is_not_reseeded_on_restart(tmp_path: Path) -> None:
    database = tmp_path / "deleted.db"
    first = DemoRepository(DATA_DIR, database)
    for subscription in first.list_subscriptions("demo-user"):
        assert first.delete_subscription(subscription["subscription_id"])

    restarted = DemoRepository(DATA_DIR, database)
    assert restarted.list_subscriptions("demo-user") == []


def test_seed_reports_are_relative_to_hong_kong_clock(tmp_path: Path) -> None:
    repository = DemoRepository(
        DATA_DIR,
        tmp_path / "relative-seeds.db",
        FrozenClock(),
    )
    first = repository.get_reports()[0]
    effective_at = datetime.fromisoformat(first["timestamp"])

    assert int((FROZEN_NOW - effective_at).total_seconds() / 60) == 26


def test_local_provider_uses_embedded_fallback_for_invalid_fixture(tmp_path: Path) -> None:
    fixture = tmp_path / "weather.json"
    fixture.write_text("[]", encoding="utf-8")

    provider = LocalJsonProvider(
        name="weather",
        path=fixture,
        fallback=WEATHER_FALLBACK,
        validator=has_keys("condition", "transport_buffer_minutes"),
        now=FROZEN_NOW,
    )

    assert provider.get()["condition"] == "clear"
    assert provider.status()["status"] == "fallback"
    assert provider.status()["fallback"] is True


def test_labeled_snapshot_contains_feedback_and_auditable_metadata(
    repository: DemoRepository,
    tmp_path: Path,
) -> None:
    repository.save_forecast_run(
        {
            "id": "forecast-snapshot-test",
            "generated_at": FROZEN_NOW.isoformat(),
            "target_time": "2026-07-10T09:30:00+08:00",
            "query": {"origin_id": "hku", "destination_id": "nanshan-tech"},
            "model_version": "time-weighted-statistical-demo-v2",
            "data_version": "provider-version",
            "data_sources": repository.get_provider_statuses(),
        },
        [
            {
                "port_id": "luohu",
                "port_name": "罗湖",
                "statistical_wait_minutes": 20,
                "shadow_wait_minutes": 21,
                "shadow_status": "available",
                "shadow_reason": None,
                "features": {"weather": "rain", "is_holiday": False},
            }
        ],
    )
    linked = repository.link_feedback_to_forecast(
        report_id="report-snapshot-test",
        forecast_run_id="forecast-snapshot-test",
        port_id="luohu",
        actual_wait_minutes=18,
        quality_score=100,
        eligible_for_label=True,
    )

    result = export_labeled_snapshot(repository, tmp_path / "snapshots")
    metadata = json.loads(Path(result["metadata_path"]).read_text(encoding="utf-8"))

    assert linked == {"linked": True, "labeled": True, "reason": None}
    assert result["sample_count"] == 1
    assert "actual_wait_minutes" in Path(result["csv_path"]).read_text(encoding="utf-8")
    assert metadata["sha256"] == result["sha256"]
    assert metadata["readiness"]["label_count"] == 1
