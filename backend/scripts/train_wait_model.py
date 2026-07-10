from argparse import ArgumentParser
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo
import json
import sys

import joblib
import numpy
import sklearn


REPO_ROOT = Path(__file__).resolve().parents[2]
BACKEND_ROOT = REPO_ROOT / "backend"
sys.path.insert(0, str(BACKEND_ROOT))

from app.ml.data import dataset_sha256, load_wait_history, split_chronologically  # noqa: E402
from app.ml.features import FEATURE_NAMES  # noqa: E402
from app.ml.reporting import build_markdown_report  # noqa: E402
from app.ml.training import RANDOM_STATE, run_experiment  # noqa: E402


MODEL_VERSION = "synthetic-hgb-wait-v1"
HONG_KONG_TZ = ZoneInfo("Asia/Hong_Kong")


def parse_args():
    parser = ArgumentParser(description="训练并评估离线口岸等待模型 v1")
    parser.add_argument(
        "--data",
        type=Path,
        default=REPO_ROOT / "data/history/port_wait_history.csv",
    )
    parser.add_argument(
        "--artifact",
        type=Path,
        default=REPO_ROOT / "data/runtime/models/wait_model_v1.joblib",
    )
    parser.add_argument(
        "--metadata",
        type=Path,
        default=REPO_ROOT / "data/models/wait_model_v1.metadata.json",
    )
    parser.add_argument(
        "--report",
        type=Path,
        default=REPO_ROOT / "docs/model_v1_report.md",
    )
    return parser.parse_args()


def split_metadata(records, date_range):
    return {
        "start": date_range[0].isoformat(),
        "end": date_range[1].isoformat(),
        "sample_count": len(records),
    }


def main() -> None:
    args = parse_args()
    records = load_wait_history(args.data)
    split = split_chronologically(records)
    result = run_experiment(split)
    generated_at = datetime.now(HONG_KONG_TZ).replace(microsecond=0).isoformat()
    metadata = {
        "schema_version": 1,
        "model_version": MODEL_VERSION,
        "generated_at": generated_at,
        "evaluation_scope": "synthetic_engineering_reference",
        "synthetic_only": True,
        "dataset": {
            "path": str(args.data.resolve().relative_to(REPO_ROOT)),
            "sha256": dataset_sha256(args.data),
            "sample_count": len(records),
            "start": records[0].timestamp.isoformat(),
            "end": records[-1].timestamp.isoformat(),
        },
        "split": {
            "train": split_metadata(split.train, split.train_dates),
            "validation": split_metadata(split.validation, split.validation_dates),
            "test": split_metadata(split.test, split.test_dates),
        },
        "features": list(FEATURE_NAMES),
        "excluded_target_derived_fields": ["crowd_level"],
        "selected_parameters": result.selected_parameters,
        "random_state": RANDOM_STATE,
        "residual_q90_by_port": result.residual_q90_by_port,
        "metrics": result.metrics,
        "permutation_importance": result.permutation_importance,
        "promotion": result.promotion,
        "libraries": {
            "python": sys.version.split()[0],
            "numpy": numpy.__version__,
            "scikit_learn": sklearn.__version__,
            "joblib": joblib.__version__,
        },
        "limitations": [
            "模型只在确定性合成数据上训练和评估。",
            "指标仅用于工程流水线参考，不代表真实口岸效果。",
            "获得真实数据后必须重新划分训练、验证和测试集。",
        ],
    }
    artifact = {
        "schema_version": 1,
        "model_version": MODEL_VERSION,
        "feature_names": list(FEATURE_NAMES),
        "estimator": result.estimator,
        "residual_q90_by_port": result.residual_q90_by_port,
        "metadata": {
            "dataset_sha256": metadata["dataset"]["sha256"],
            "selected_parameters": result.selected_parameters,
            "promotion_status": result.promotion["status"],
            "synthetic_only": True,
        },
    }
    args.artifact.parent.mkdir(parents=True, exist_ok=True)
    args.metadata.parent.mkdir(parents=True, exist_ok=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, args.artifact)
    args.metadata.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    args.report.write_text(build_markdown_report(metadata), encoding="utf-8")
    print(f"artifact={args.artifact}")
    print(f"metadata={args.metadata}")
    print(f"report={args.report}")
    print(f"promotion_status={result.promotion['status']}")


if __name__ == "__main__":
    main()
