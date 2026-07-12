"""Train, compare, audit, and promote the classroom AI v2.2 base model."""

from argparse import ArgumentParser
from datetime import datetime
from io import BytesIO
from pathlib import Path
from zoneinfo import ZoneInfo
import csv
import hashlib
import json
import sys

import joblib
import numpy as np
from sklearn.base import clone
from sklearn.ensemble import ExtraTreesRegressor, HistGradientBoostingRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))
from app.config import AI_V2_DATASET_METADATA_PATH, AI_V2_DATASET_PATH  # noqa: E402
from app.ml.scenario_features import FEATURE_NAMES, PORTS, scenario_feature_vector  # noqa: E402

DATASET = AI_V2_DATASET_PATH
DATASET_METADATA = AI_V2_DATASET_METADATA_PATH
ARTIFACT = ROOT / "data/runtime/models/wait_model_v2.joblib"
DEFAULT_METADATA = ROOT / "data/models/wait_model_v2.metadata.json"
MODEL_VERSION = "public-traffic-transparent-hgb-v2.2"
SCHEMA_VERSION = 4
CALIBRATION_VERSION = "transparent-scenario-official-shenzhen-crowd-v2"


def parse_args():
    parser = ArgumentParser()
    parser.add_argument("--dataset", type=Path, default=DATASET)
    parser.add_argument("--dataset-metadata", type=Path, default=DATASET_METADATA)
    parser.add_argument("--artifact", type=Path, default=ARTIFACT)
    parser.add_argument("--metadata", type=Path, default=DEFAULT_METADATA)
    return parser.parse_args()


def candidate_estimators():
    for alpha in (0.1, 1.0, 10.0):
        yield "ridge", {"alpha": alpha}, Ridge(alpha=alpha)
    for max_features in (0.7, 1.0):
        for min_samples_leaf in (1, 2, 4):
            params = {"n_estimators": 300, "max_features": max_features, "min_samples_leaf": min_samples_leaf}
            yield "extra_trees", params, ExtraTreesRegressor(**params, n_jobs=-1, random_state=2612)
    for max_leaf_nodes in (15, 31):
        for learning_rate in (0.05, 0.08):
            for min_samples_leaf in (20, 40):
                for l2_regularization in (1.0, 3.0):
                    params = {"max_iter": 300, "max_leaf_nodes": max_leaf_nodes, "learning_rate": learning_rate, "min_samples_leaf": min_samples_leaf, "l2_regularization": l2_regularization}
                    yield "hist_gradient_boosting", params, HistGradientBoostingRegressor(**params, random_state=2612)


def metric(actual, predicted):
    return {
        "sample_count": int(len(actual)),
        "mae": round(float(mean_absolute_error(actual, predicted)), 4),
        "rmse": round(float(mean_squared_error(actual, predicted) ** 0.5), 4),
        "r2": round(float(r2_score(actual, predicted)), 4),
        "p90_absolute_error": round(float(np.quantile(np.abs(actual - predicted), 0.9)), 4),
    }


def estimator_size(estimator) -> int:
    stream = BytesIO()
    joblib.dump(estimator, stream)
    return stream.tell()


def main() -> None:
    args = parse_args()
    dataset_metadata = json.loads(args.dataset_metadata.read_text(encoding="utf-8"))
    digest = hashlib.sha256(args.dataset.read_bytes()).hexdigest()
    if dataset_metadata.get("dataset", {}).get("sha256") != digest or not dataset_metadata.get("audit", {}).get("passed"):
        raise SystemExit("场景数据哈希或数据审计无效。")
    rows = list(csv.DictReader(args.dataset.open(encoding="utf-8")))
    dates = sorted({row["timestamp"][:10] for row in rows})
    train_end = dates[int(len(dates) * 0.70) - 1]
    validation_end = dates[int(len(dates) * 0.85) - 1]
    x = np.asarray([
        scenario_feature_vector(
            port=row["port"], direction=row["direction"], timestamp=datetime.fromisoformat(row["timestamp"]),
            weather=row["weather"], is_holiday=row["is_holiday"] == "true", event_impact=row["event_impact"],
            traffic_pressure=float(row["traffic_pressure"]), traffic_available=row["traffic_available"] == "true",
        ) for row in rows
    ])
    y = np.asarray([float(row["wait_minutes"]) for row in rows])
    train_mask = np.asarray([row["timestamp"][:10] <= train_end for row in rows])
    validation_mask = np.asarray([train_end < row["timestamp"][:10] <= validation_end for row in rows])
    test_mask = ~(train_mask | validation_mask)

    candidates = []
    fitted = []
    for algorithm, params, estimator in candidate_estimators():
        estimator.fit(x[train_mask], y[train_mask])
        predicted = estimator.predict(x[validation_mask])
        entry = {"algorithm": algorithm, "parameters": params, "validation": metric(y[validation_mask], predicted), "artifact_size_bytes": estimator_size(estimator)}
        candidates.append(entry)
        fitted.append((entry, estimator))
    best_mae = min(entry["validation"]["mae"] for entry in candidates)
    contenders = [(entry, estimator) for entry, estimator in fitted if entry["validation"]["mae"] <= best_mae * 1.01]
    selected_entry, model = min(contenders, key=lambda item: (item[0]["artifact_size_bytes"], item[0]["validation"]["mae"]))
    candidates.sort(key=lambda item: (item["validation"]["mae"], item["artifact_size_bytes"]))
    selection = {
        "algorithm": selected_entry["algorithm"],
        "parameters": selected_entry["parameters"],
        "rule": "最低验证 MAE；1%以内以产物大小决胜；测试集不参与选择",
        "candidate_count": len(candidates),
        "minimum_validation_mae": best_mae,
        "selected_validation_mae": selected_entry["validation"]["mae"],
    }

    validation_prediction = model.predict(x[validation_mask])
    test_prediction = model.predict(x[test_mask])
    metrics = {"validation": metric(y[validation_mask], validation_prediction), "test": metric(y[test_mask], test_prediction)}
    train_rows = [row for row, include in zip(rows, train_mask) if include]
    validation_rows = [row for row, include in zip(rows, validation_mask) if include]
    test_rows = [row for row, include in zip(rows, test_mask) if include]
    baseline_groups: dict[tuple[str, str, int], list[float]] = {}
    for row, value in zip(train_rows, y[train_mask]):
        key = (row["port"], row["direction"], datetime.fromisoformat(row["timestamp"]).hour)
        baseline_groups.setdefault(key, []).append(float(value))
    baseline_means = {key: float(np.mean(values)) for key, values in baseline_groups.items()}
    baseline_prediction = np.asarray([baseline_means[(row["port"], row["direction"], datetime.fromisoformat(row["timestamp"]).hour)] for row in test_rows])
    metrics["calendar_baseline_test"] = metric(y[test_mask], baseline_prediction)

    x_without_traffic = x.copy()
    x_without_traffic[:, FEATURE_NAMES.index("traffic_pressure")] = 1.0
    x_without_traffic[:, FEATURE_NAMES.index("traffic_available")] = 0.0
    ablation = clone(model).fit(x_without_traffic[train_mask], y[train_mask])
    ablation_prediction = ablation.predict(x_without_traffic[test_mask])
    ablation_mae = float(mean_absolute_error(y[test_mask], ablation_prediction))
    metrics["traffic_ablation_test"] = {**metric(y[test_mask], ablation_prediction), "improvement_percent": round((ablation_mae - metrics["test"]["mae"]) / ablation_mae * 100, 2)}

    residuals = {}
    coverage_by_port = {}
    for port in PORTS:
        validation_residual = np.asarray([abs(actual - predicted) for row, actual, predicted in zip(validation_rows, y[validation_mask], validation_prediction) if row["port"] == port])
        residuals[port] = round(float(np.quantile(validation_residual, 0.9, method="higher")), 4)
        port_test = [(actual, predicted) for row, actual, predicted in zip(test_rows, y[test_mask], test_prediction) if row["port"] == port]
        coverage_by_port[port] = round(sum(abs(actual - predicted) <= residuals[port] for actual, predicted in port_test) / len(port_test) * 100, 2)
    covered = [abs(actual - predicted) <= residuals[row["port"]] for row, actual, predicted in zip(test_rows, y[test_mask], test_prediction)]
    interval_calibration = {
        "method": "per_port_validation_absolute_residual_q90",
        "nominal_coverage_percent": 90,
        "test_coverage_percent": round(float(np.mean(covered) * 100), 2),
        "coverage_by_port_percent": coverage_by_port,
        "average_interval_width_minutes": round(float(np.mean([2 * residuals[row["port"]] for row in test_rows])), 4),
        "residual_q90_by_port": residuals,
    }

    train_pressure = np.asarray([float(row["traffic_pressure"]) for row in train_rows])
    train_raw_pressure = np.asarray([float(row["raw_traffic_pressure"]) for row in train_rows])
    traffic_distribution = {"q01": round(float(np.quantile(train_raw_pressure, 0.01)), 4), "q50": round(float(np.quantile(train_raw_pressure, 0.50)), 4), "q99": round(float(np.quantile(train_raw_pressure, 0.99)), 4), "hard_bounds": [0.6, 1.8]}
    pressure_edges = np.quantile(train_pressure, [0.25, 0.5, 0.75])
    hour_buckets = ((0, 6, "00-05"), (6, 10, "06-09"), (10, 16, "10-15"), (16, 20, "16-19"), (20, 24, "20-23"))
    slices: dict[str, dict] = {}
    slice_specs = []
    for field, values in (("port", PORTS), ("direction", ("hong_kong_to_shenzhen", "shenzhen_to_hong_kong")), ("weather", ("clear", "rain", "heavy_rain", "thunderstorm")), ("event_impact", ("none", "low", "medium", "high")), ("is_holiday", ("true", "false"))):
        for value in values:
            slice_specs.append((f"{field}:{value}", np.asarray([row[field] == value for row in test_rows])))
    for start, end, label in hour_buckets:
        slice_specs.append((f"hour:{label}", np.asarray([start <= datetime.fromisoformat(row["timestamp"]).hour < end for row in test_rows])))
    pressure_values = np.asarray([float(row["traffic_pressure"]) for row in test_rows])
    pressure_bins = np.digitize(pressure_values, pressure_edges)
    for index, label in enumerate(("q1", "q2", "q3", "q4")):
        slice_specs.append((f"traffic_pressure:{label}", pressure_bins == index))
    for name, mask in slice_specs:
        if int(mask.sum()) >= 50:
            slices[name] = metric(y[test_mask][mask], test_prediction[mask])
    metrics["test_slices"] = slices

    violations = []
    for port in PORTS:
        for direction in ("hong_kong_to_shenzhen", "shenzhen_to_hong_kong"):
            for hour in (7, 9, 12, 18, 21):
                common = {"port": port, "direction": direction, "timestamp": datetime(2026, 7, 10, hour), "weather": "clear", "is_holiday": False, "traffic_available": True}
                traffic_values = [float(model.predict([scenario_feature_vector(**common, event_impact="none", traffic_pressure=value)])[0]) for value in (0.6, 0.8, 1.0, 1.2, 1.5, 1.8)]
                event_values = [float(model.predict([scenario_feature_vector(**common, event_impact=value, traffic_pressure=1.0)])[0]) for value in ("none", "low", "medium", "high")]
                if any(right + 1e-8 < left for left, right in zip(traffic_values, traffic_values[1:])):
                    violations.append({"type": "traffic_pressure", "port": port, "direction": direction, "hour": hour})
                if any(right + 1e-8 < left for left, right in zip(event_values, event_values[1:])):
                    violations.append({"type": "event_impact", "port": port, "direction": direction, "hour": hour})
    sensitivity = {"grid_points": len(PORTS) * 2 * 5 * 2, "violation_count": len(violations), "violations": violations}

    baseline_improvement = round((metrics["calendar_baseline_test"]["mae"] - metrics["test"]["mae"]) / metrics["calendar_baseline_test"]["mae"] * 100, 2)
    test_degradation = round((metrics["test"]["mae"] - metrics["validation"]["mae"]) / metrics["validation"]["mae"] * 100, 2)
    worst_slice = max(slices.items(), key=lambda item: item[1]["mae"])
    checks = [
        {"name": "calendar_baseline_improvement", "passed": baseline_improvement >= 25, "actual": baseline_improvement, "required": ">=25%"},
        {"name": "traffic_ablation_improvement", "passed": metrics["traffic_ablation_test"]["improvement_percent"] >= 10, "actual": metrics["traffic_ablation_test"]["improvement_percent"], "required": ">=10%"},
        {"name": "test_degradation", "passed": test_degradation <= 15, "actual": test_degradation, "required": "<=15%"},
        {"name": "overall_interval_coverage", "passed": 88 <= interval_calibration["test_coverage_percent"] <= 95, "actual": interval_calibration["test_coverage_percent"], "required": "88-95%"},
        {"name": "port_interval_coverage", "passed": all(85 <= value <= 96 for value in coverage_by_port.values()), "actual": coverage_by_port, "required": "each 85-96%"},
        {"name": "worst_slice_mae", "passed": worst_slice[1]["mae"] <= 2.5, "actual": {"slice": worst_slice[0], "mae": worst_slice[1]["mae"]}, "required": "<=2.5"},
        {"name": "sensitivity_monotonicity", "passed": not violations, "actual": len(violations), "required": "0 violations"},
        {"name": "data_audit", "passed": dataset_metadata["audit"]["passed"], "actual": dataset_metadata["audit"], "required": "passed"},
    ]
    promotion = {"passed": all(check["passed"] for check in checks), "checks": checks}
    metadata = {
        "schema_version": SCHEMA_VERSION,
        "model_version": MODEL_VERSION,
        "generated_at": datetime.now(ZoneInfo("Asia/Hong_Kong")).replace(microsecond=0).isoformat(),
        "evaluation_scope": "public_data_hybrid_classroom_demo",
        "synthetic_only": False,
        "target_scope": "public_feature_transparent_base_target",
        "real_feature_sources": [dataset_metadata["source_snapshot"]["source_id"]],
        "calibration_version": CALIBRATION_VERSION,
        "dataset": dataset_metadata["dataset"],
        "source_snapshot": dataset_metadata["source_snapshot"],
        "data_audit": dataset_metadata["audit"],
        "formula": {"version": dataset_metadata["formula_version"], "coefficients": dataset_metadata["coefficients"]},
        "split": {"strategy": "chronological_70_15_15", "train_end": train_end, "validation_end": validation_end, "test_end": dates[-1], "test_used_for_selection": False},
        "features": list(FEATURE_NAMES),
        "selection": selection,
        "candidate_leaderboard": candidates,
        "metrics": metrics,
        "interval_calibration": interval_calibration,
        "traffic_distribution": traffic_distribution,
        "sensitivity": sensitivity,
        "promotion": promotion,
        "residual_q90_by_port": residuals,
        "limitations": ["真实官方客流作为特征，基础等待分钟仍为可解释生成标签。", "天气、节假日、事件、官方等级、深圳核验与众包只在运行时透明校准，不进入离线 MAE。", "指标用于课堂演示，不代表真实口岸准确率。"],
    }
    artifact = {
        "schema_version": SCHEMA_VERSION, "model_version": MODEL_VERSION,
        "feature_names": list(FEATURE_NAMES), "dataset_sha256": digest,
        "source_snapshot_sha256": dataset_metadata["source_snapshot"]["sha256"],
        "estimator": model, "selection": selection,
        "residual_q90_by_port": residuals, "traffic_distribution": traffic_distribution,
        "calibration_version": CALIBRATION_VERSION,
    }
    args.artifact.parent.mkdir(parents=True, exist_ok=True)
    args.metadata.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, args.artifact)
    args.metadata.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    if not promotion["passed"]:
        failed = ", ".join(check["name"] for check in checks if not check["passed"])
        raise SystemExit(f"AI v2.2 未通过晋级门槛：{failed}")
    print(f"artifact={args.artifact}\nmetadata={args.metadata}\nselected={selection['algorithm']}\ntest_mae={metrics['test']['mae']}\ncoverage={interval_calibration['test_coverage_percent']}")


if __name__ == "__main__":
    main()
