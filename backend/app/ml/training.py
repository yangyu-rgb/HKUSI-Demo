from dataclasses import dataclass
from itertools import product
from math import sqrt
from typing import Any
import os


os.environ.setdefault("LOKY_MAX_CPU_COUNT", "1")

import numpy as np
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.inspection import permutation_importance
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from .baselines import CalendarMeanBaseline
from .data import DatasetSplit, EXPECTED_PORTS, WaitRecord
from .features import FEATURE_NAMES, build_feature_matrix, build_target


RANDOM_STATE = 2612
DEFAULT_PARAMETER_GRID = tuple(
    {
        "learning_rate": learning_rate,
        "max_leaf_nodes": max_leaf_nodes,
        "min_samples_leaf": min_samples_leaf,
    }
    for learning_rate, max_leaf_nodes, min_samples_leaf in product(
        (0.05, 0.1),
        (7, 15, 31),
        (10, 20, 40),
    )
)


@dataclass(frozen=True)
class ExperimentResult:
    estimator: HistGradientBoostingRegressor
    selected_parameters: dict[str, float | int]
    residual_q90_by_port: dict[str, float]
    metrics: dict[str, Any]
    permutation_importance: list[dict[str, float | str]]
    promotion: dict[str, Any]


def _metric_values(actual: np.ndarray, predicted: np.ndarray) -> dict[str, float]:
    errors = predicted - actual
    return {
        "mae": round(float(np.mean(np.abs(errors))), 4),
        "rmse": round(float(sqrt(np.mean(errors**2))), 4),
    }


def _evaluation_summary(
    records: tuple[WaitRecord, ...],
    actual: np.ndarray,
    predicted: np.ndarray,
) -> dict[str, Any]:
    by_port = {}
    for port in EXPECTED_PORTS:
        mask = np.asarray([record.port == port for record in records])
        by_port[port] = _metric_values(actual[mask], predicted[mask])
    slice_masks = {
        "morning_peak": np.asarray(
            [7 <= record.timestamp.hour <= 10 for record in records]
        ),
        "evening_peak": np.asarray(
            [17 <= record.timestamp.hour <= 20 for record in records]
        ),
        "off_peak": np.asarray(
            [
                not (7 <= record.timestamp.hour <= 10)
                and not (17 <= record.timestamp.hour <= 20)
                for record in records
            ]
        ),
        "rain": np.asarray([record.weather == "rain" for record in records]),
        "clear": np.asarray([record.weather == "clear" for record in records]),
        "holiday": np.asarray([record.is_holiday for record in records]),
        "non_holiday": np.asarray([not record.is_holiday for record in records]),
    }
    slices = {
        name: {
            **_metric_values(actual[mask], predicted[mask]),
            "sample_count": int(mask.sum()),
        }
        for name, mask in slice_masks.items()
        if mask.any()
    }
    return {
        "overall": {
            **_metric_values(actual, predicted),
            "sample_count": len(records),
        },
        "by_port": by_port,
        "slices": slices,
    }


def _build_estimator(
    parameters: dict[str, float | int],
    *,
    max_iter: int,
) -> HistGradientBoostingRegressor:
    return HistGradientBoostingRegressor(
        loss="squared_error",
        learning_rate=float(parameters["learning_rate"]),
        max_iter=max_iter,
        max_leaf_nodes=int(parameters["max_leaf_nodes"]),
        min_samples_leaf=int(parameters["min_samples_leaf"]),
        l2_regularization=1.0,
        early_stopping=False,
        random_state=RANDOM_STATE,
    )


def _residual_quantiles(
    records: tuple[WaitRecord, ...],
    actual: np.ndarray,
    predicted: np.ndarray,
) -> dict[str, float]:
    quantiles = {}
    for port in EXPECTED_PORTS:
        mask = np.asarray([record.port == port for record in records])
        residuals = np.abs(actual[mask] - predicted[mask])
        quantiles[port] = round(
            float(np.quantile(residuals, 0.9, method="higher")),
            4,
        )
    return quantiles


def _interval_metrics(
    records: tuple[WaitRecord, ...],
    actual: np.ndarray,
    predicted: np.ndarray,
    residual_q90_by_port: dict[str, float],
) -> dict[str, Any]:
    widths = np.asarray(
        [2 * residual_q90_by_port[record.port] for record in records],
        dtype=float,
    )
    half_widths = widths / 2
    covered = (actual >= predicted - half_widths) & (actual <= predicted + half_widths)
    by_port = {}
    for port in EXPECTED_PORTS:
        mask = np.asarray([record.port == port for record in records])
        by_port[port] = {
            "coverage": round(float(np.mean(covered[mask])), 4),
            "mean_width": round(float(np.mean(widths[mask])), 4),
        }
    return {
        "coverage": round(float(np.mean(covered)), 4),
        "mean_width": round(float(np.mean(widths)), 4),
        "by_port": by_port,
    }


def run_experiment(
    split: DatasetSplit,
    *,
    parameter_grid: tuple[dict[str, float | int], ...] = DEFAULT_PARAMETER_GRID,
    max_iter: int = 300,
    permutation_repeats: int = 10,
) -> ExperimentResult:
    train_x = build_feature_matrix(split.train)
    validation_x = build_feature_matrix(split.validation)
    test_x = build_feature_matrix(split.test)
    train_y = build_target(split.train)
    validation_y = build_target(split.validation)
    test_y = build_target(split.test)

    calendar = CalendarMeanBaseline().fit(split.train)
    calendar_validation = calendar.predict(split.validation)
    calendar_test = calendar.predict(split.test)

    ridge = make_pipeline(StandardScaler(), Ridge(alpha=1.0))
    ridge.fit(train_x, train_y)
    ridge_validation = ridge.predict(validation_x)
    ridge_test = ridge.predict(test_x)

    candidates = []
    for parameters in parameter_grid:
        estimator = _build_estimator(parameters, max_iter=max_iter)
        estimator.fit(train_x, train_y)
        validation_prediction = estimator.predict(validation_x)
        validation_mae = _metric_values(validation_y, validation_prediction)["mae"]
        candidates.append((validation_mae, int(parameters["max_leaf_nodes"]), parameters, estimator))
    if not candidates:
        raise ValueError("梯度提升参数网格为空")
    _mae, _complexity, selected_parameters, estimator = min(
        candidates,
        key=lambda item: (item[0], item[1]),
    )
    validation_prediction = estimator.predict(validation_x)
    test_prediction = estimator.predict(test_x)
    residual_q90_by_port = _residual_quantiles(
        split.validation,
        validation_y,
        validation_prediction,
    )

    models = {
        "calendar_mean": {
            "validation": _evaluation_summary(
                split.validation,
                validation_y,
                calendar_validation,
            ),
            "test": _evaluation_summary(split.test, test_y, calendar_test),
        },
        "ridge": {
            "validation": _evaluation_summary(
                split.validation,
                validation_y,
                ridge_validation,
            ),
            "test": _evaluation_summary(split.test, test_y, ridge_test),
        },
        "hist_gradient_boosting": {
            "validation": _evaluation_summary(
                split.validation,
                validation_y,
                validation_prediction,
            ),
            "test": _evaluation_summary(split.test, test_y, test_prediction),
            "intervals": _interval_metrics(
                split.test,
                test_y,
                test_prediction,
                residual_q90_by_port,
            ),
        },
    }

    importance = permutation_importance(
        estimator,
        test_x,
        test_y,
        scoring="neg_mean_absolute_error",
        n_repeats=permutation_repeats,
        n_jobs=1,
        random_state=RANDOM_STATE,
    )
    importance_rows = sorted(
        [
            {
                "feature": feature,
                "mean": round(float(mean), 6),
                "standard_deviation": round(float(std), 6),
            }
            for feature, mean, std in zip(
                FEATURE_NAMES,
                importance.importances_mean,
                importance.importances_std,
            )
        ],
        key=lambda item: float(item["mean"]),
        reverse=True,
    )

    candidate_mae = models["hist_gradient_boosting"]["test"]["overall"]["mae"]
    baseline_mae = min(
        models["calendar_mean"]["test"]["overall"]["mae"],
        models["ridge"]["test"]["overall"]["mae"],
    )
    improvement = (baseline_mae - candidate_mae) / baseline_mae
    port_deltas = {}
    port_gate = True
    for port in EXPECTED_PORTS:
        candidate_port_mae = models["hist_gradient_boosting"]["test"]["by_port"][port]["mae"]
        baseline_port_mae = min(
            models["calendar_mean"]["test"]["by_port"][port]["mae"],
            models["ridge"]["test"]["by_port"][port]["mae"],
        )
        delta = candidate_port_mae - baseline_port_mae
        port_deltas[port] = round(delta, 4)
        port_gate = port_gate and delta <= 1.0
    coverage = models["hist_gradient_boosting"]["intervals"]["coverage"]
    passed = improvement >= 0.05 and port_gate and coverage >= 0.85
    promotion = {
        "status": "eligible" if passed else "rejected",
        "overall_mae_improvement": round(improvement, 4),
        "minimum_required_improvement": 0.05,
        "port_mae_delta_vs_best_baseline": port_deltas,
        "maximum_allowed_port_degradation": 1.0,
        "interval_coverage": coverage,
        "minimum_required_coverage": 0.85,
    }
    return ExperimentResult(
        estimator=estimator,
        selected_parameters=dict(selected_parameters),
        residual_q90_by_port=residual_q90_by_port,
        metrics=models,
        permutation_importance=importance_rows,
        promotion=promotion,
    )
