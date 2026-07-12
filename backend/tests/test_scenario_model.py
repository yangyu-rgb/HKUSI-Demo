from datetime import datetime
from pathlib import Path
import json
import hashlib
import subprocess
import sys

from app.ml.scenario_model import ScenarioWaitModel


ROOT = Path(__file__).resolve().parents[2]
METADATA = ROOT / "data/models/wait_model_v2.metadata.json"


def test_v2_artifact_loads_and_leaves_scenario_to_transparent_runtime_layer() -> None:
    model = ScenarioWaitModel.load_optional()
    assert model.status.available is True
    common = {
        "port": "深圳湾",
        "direction": "hong_kong_to_shenzhen",
        "timestamp": datetime.fromisoformat("2026-07-10T09:30:00+08:00"),
    }
    baseline = model.predict(**common, weather="clear", is_holiday=False, event_impact="none")
    severe = model.predict(**common, weather="heavy_rain", is_holiday=True, event_impact="high")
    assert baseline is not None and severe is not None
    assert severe[0] == baseline[0]


def test_v2_loader_fails_closed_when_artifact_is_missing(tmp_path) -> None:
    model = ScenarioWaitModel.load_optional(artifact_path=tmp_path / "missing.joblib")
    assert model.status.available is False
    assert model.predict(
        port="罗湖",
        direction="hong_kong_to_shenzhen",
        timestamp=datetime.fromisoformat("2026-07-10T09:30:00+08:00"),
        weather="clear",
        is_holiday=False,
        event_impact="none",
    ) is None


def test_v2_final_selection_and_promotion_are_auditable() -> None:
    metadata = json.loads(METADATA.read_text(encoding="utf-8"))

    assert metadata["selection"]["candidate_count"] == 25
    assert metadata["selection"]["algorithm"] == "hist_gradient_boosting"
    assert metadata["split"]["test_used_for_selection"] is False
    assert metadata["promotion"]["passed"] is True
    assert metadata["data_audit"]["future_rows_used"] == 0
    assert 88 <= metadata["interval_calibration"]["test_coverage_percent"] <= 95
    assert metadata["sensitivity"]["violation_count"] == 0


def test_v2_loader_rejects_failed_promotion(tmp_path: Path) -> None:
    metadata = json.loads(METADATA.read_text(encoding="utf-8"))
    metadata["promotion"]["passed"] = False
    invalid = tmp_path / "metadata.json"
    invalid.write_text(json.dumps(metadata, ensure_ascii=False), encoding="utf-8")

    model = ScenarioWaitModel.load_optional(metadata_path=invalid)

    assert model.status.available is False
    assert model.status.reason == "metadata_scope_mismatch"


def test_v2_loader_rejects_tampered_public_snapshot(tmp_path: Path) -> None:
    tampered = tmp_path / "traffic.csv"
    tampered.write_text("tampered\n", encoding="utf-8")

    model = ScenarioWaitModel.load_optional(traffic_snapshot_path=tampered)

    assert model.status.available is False
    assert model.status.reason == "source_snapshot_mismatch"


def test_v2_reports_traffic_distribution_drift() -> None:
    model = ScenarioWaitModel.load_optional()

    assert model.traffic_distribution_status(1.0)["status"] == "in_distribution"
    assert model.traffic_distribution_status(0.2)["status"] == "below_training_range"
    assert model.traffic_distribution_status(3.0)["status"] == "above_training_range"


def test_v2_dataset_generation_is_deterministic_without_runtime_database(tmp_path: Path) -> None:
    script = ROOT / "backend/scripts/generate_v2_scenario_data.py"
    outputs = []
    for index in range(2):
        output = tmp_path / f"dataset-{index}.csv"
        metadata = tmp_path / f"dataset-{index}.json"
        result = subprocess.run(
            [sys.executable, str(script), "--output", str(output), "--metadata", str(metadata)],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        assert result.returncode == 0, result.stderr
        outputs.append(hashlib.sha256(output.read_bytes()).hexdigest())

    assert outputs[0] == outputs[1]
