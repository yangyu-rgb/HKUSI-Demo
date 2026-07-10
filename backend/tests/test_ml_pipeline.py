from pathlib import Path
import json
import warnings

import joblib
import numpy as np
import pytest

from app.ml.data import dataset_sha256, load_wait_history, split_chronologically
from app.ml.features import FEATURE_NAMES, build_feature_matrix
from app.ml.training import run_experiment


DATA_PATH = Path(__file__).resolve().parents[2] / "data/history/port_wait_history.csv"
METADATA_PATH = Path(__file__).resolve().parents[2] / "data/models/wait_model_v1.metadata.json"
TEST_GRID = (
    {
        "learning_rate": 0.1,
        "max_leaf_nodes": 7,
        "min_samples_leaf": 20,
    },
)


def test_history_validation_and_chronological_split() -> None:
    records = load_wait_history(DATA_PATH)
    split = split_chronologically(records)

    assert len(records) == 5376
    assert len(split.train) == 3744
    assert len(split.validation) == 768
    assert len(split.test) == 864
    assert max(item.timestamp for item in split.train) < min(
        item.timestamp for item in split.validation
    )
    assert max(item.timestamp for item in split.validation) < min(
        item.timestamp for item in split.test
    )


def test_features_exclude_target_derived_fields() -> None:
    records = load_wait_history(DATA_PATH)
    matrix = build_feature_matrix(records[:4])

    assert matrix.shape == (4, len(FEATURE_NAMES))
    assert "wait_minutes" not in FEATURE_NAMES
    assert "crowd_level" not in FEATURE_NAMES


def test_duplicate_history_key_is_rejected(tmp_path: Path) -> None:
    lines = DATA_PATH.read_text(encoding="utf-8").splitlines()
    invalid = tmp_path / "duplicate.csv"
    invalid.write_text("\n".join([*lines[:2], lines[1]]) + "\n", encoding="utf-8")

    with pytest.raises(ValueError, match="重复键"):
        load_wait_history(invalid)


def test_training_is_deterministic_and_serializable(tmp_path: Path) -> None:
    split = split_chronologically(load_wait_history(DATA_PATH))
    first = run_experiment(
        split,
        parameter_grid=TEST_GRID,
        max_iter=40,
        permutation_repeats=2,
    )
    second = run_experiment(
        split,
        parameter_grid=TEST_GRID,
        max_iter=40,
        permutation_repeats=2,
    )
    test_x = build_feature_matrix(split.test)

    np.testing.assert_allclose(
        first.estimator.predict(test_x),
        second.estimator.predict(test_x),
    )
    assert first.metrics == second.metrics
    artifact_path = tmp_path / "model.joblib"
    with warnings.catch_warnings():
        warnings.filterwarnings(
            "ignore",
            message="Setting the shape on a NumPy array has been deprecated.*",
            category=DeprecationWarning,
        )
        joblib.dump(first.estimator, artifact_path)
        restored = joblib.load(artifact_path)
    np.testing.assert_allclose(
        first.estimator.predict(test_x),
        restored.predict(test_x),
    )


def test_committed_metadata_matches_dataset_and_scope() -> None:
    metadata = json.loads(METADATA_PATH.read_text(encoding="utf-8"))

    assert metadata["dataset"]["sha256"] == dataset_sha256(DATA_PATH)
    assert metadata["evaluation_scope"] == "synthetic_engineering_reference"
    assert metadata["synthetic_only"] is True
    assert metadata["excluded_target_derived_fields"] == ["crowd_level"]
