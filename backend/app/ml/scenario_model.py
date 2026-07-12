from dataclasses import dataclass
from datetime import datetime
from math import isfinite
from pathlib import Path
from typing import Any
import hashlib
import json
import warnings

from ..config import AI_V2_ARTIFACT_PATH, AI_V2_DATASET_PATH, AI_V2_METADATA_PATH, AI_V2_MODEL_VERSION, AI_V2_SCHEMA_VERSION, AI_V2_TRAFFIC_METADATA_PATH, AI_V2_TRAFFIC_SNAPSHOT_PATH
from .scenario_features import FEATURE_NAMES, PORTS, scenario_feature_vector


@dataclass(frozen=True)
class ScenarioModelStatus:
    available: bool
    reason: str | None
    model_version: str | None


class ScenarioWaitModel:
    def __init__(self, estimator: Any | None, residuals: dict[str, float], traffic_distribution: dict[str, float], calibration_version: str | None, status: ScenarioModelStatus):
        self._estimator = estimator
        self._residuals = residuals
        self._traffic_distribution = traffic_distribution
        self._calibration_version = calibration_version
        self._status = status

    @property
    def status(self) -> ScenarioModelStatus:
        return self._status

    @classmethod
    def unavailable(cls, reason: str) -> "ScenarioWaitModel":
        return cls(None, {}, {}, None, ScenarioModelStatus(False, reason, None))

    @classmethod
    def load_optional(cls, artifact_path: Path = AI_V2_ARTIFACT_PATH, metadata_path: Path = AI_V2_METADATA_PATH, dataset_path: Path = AI_V2_DATASET_PATH, traffic_snapshot_path: Path = AI_V2_TRAFFIC_SNAPSHOT_PATH, traffic_metadata_path: Path = AI_V2_TRAFFIC_METADATA_PATH) -> "ScenarioWaitModel":
        try:
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            if metadata.get("schema_version") != AI_V2_SCHEMA_VERSION or metadata.get("model_version") != AI_V2_MODEL_VERSION:
                return cls.unavailable("metadata_version_mismatch")
            if (
                metadata.get("features") != list(FEATURE_NAMES)
                or metadata.get("target_scope") != "public_feature_transparent_base_target"
                or metadata.get("evaluation_scope") != "public_data_hybrid_classroom_demo"
                or metadata.get("promotion", {}).get("passed") is not True
                or metadata.get("split", {}).get("test_used_for_selection") is not False
            ):
                return cls.unavailable("metadata_scope_mismatch")
            digest = hashlib.sha256(dataset_path.read_bytes()).hexdigest()
            if digest != metadata.get("dataset", {}).get("sha256"):
                return cls.unavailable("dataset_mismatch")
            traffic_digest = hashlib.sha256(traffic_snapshot_path.read_bytes()).hexdigest()
            traffic_metadata = json.loads(traffic_metadata_path.read_text(encoding="utf-8"))
            if traffic_digest != traffic_metadata.get("sha256") or traffic_digest != metadata.get("source_snapshot", {}).get("sha256"):
                return cls.unavailable("source_snapshot_mismatch")
            import joblib
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                artifact = joblib.load(artifact_path)
            if artifact.get("schema_version") != AI_V2_SCHEMA_VERSION or artifact.get("model_version") != AI_V2_MODEL_VERSION or artifact.get("feature_names") != list(FEATURE_NAMES) or artifact.get("dataset_sha256") != digest or artifact.get("source_snapshot_sha256") != traffic_digest:
                return cls.unavailable("artifact_mismatch")
            residuals = artifact.get("residual_q90_by_port", {})
            if set(residuals) != set(PORTS) or any(not isinstance(value, (int, float)) or value <= 0 for value in residuals.values()):
                return cls.unavailable("residuals_invalid")
            if not callable(getattr(artifact.get("estimator"), "predict", None)):
                return cls.unavailable("estimator_invalid")
            traffic_distribution = artifact.get("traffic_distribution", {})
            if not {"q01", "q50", "q99", "hard_bounds"} <= set(traffic_distribution):
                return cls.unavailable("traffic_distribution_invalid")
            if artifact.get("calibration_version") != metadata.get("calibration_version"):
                return cls.unavailable("calibration_version_mismatch")
            return cls(artifact["estimator"], residuals, traffic_distribution, artifact["calibration_version"], ScenarioModelStatus(True, None, AI_V2_MODEL_VERSION))
        except FileNotFoundError:
            return cls.unavailable("artifact_missing")
        except Exception:
            return cls.unavailable("artifact_unreadable")

    def predict(self, **inputs) -> tuple[float, float] | None:
        if not self._status.available or self._estimator is None:
            return None
        try:
            inputs.setdefault("traffic_pressure", 1.0)
            inputs.setdefault("traffic_available", False)
            value = float(self._estimator.predict([scenario_feature_vector(**inputs)])[0])
            if not isfinite(value):
                raise ValueError
            return max(1.0, value), self._residuals[inputs["port"]]
        except Exception:
            self._status = ScenarioModelStatus(False, "prediction_failed", None)
            return None

    @property
    def calibration_version(self) -> str | None:
        return self._calibration_version

    def traffic_distribution_status(self, raw_pressure: float) -> dict:
        if not self._traffic_distribution:
            return {"status": "unknown", "raw_pressure": raw_pressure}
        q01 = float(self._traffic_distribution["q01"])
        q99 = float(self._traffic_distribution["q99"])
        return {
            "status": "below_training_range" if raw_pressure < q01 else "above_training_range" if raw_pressure > q99 else "in_distribution",
            "raw_pressure": round(raw_pressure, 4),
            "q01": q01,
            "q50": float(self._traffic_distribution["q50"]),
            "q99": q99,
            "hard_bounds": self._traffic_distribution["hard_bounds"],
        }
