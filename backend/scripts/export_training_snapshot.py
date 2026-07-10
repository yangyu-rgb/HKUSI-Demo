"""Export the local forecast-feedback label snapshot for V2 pre-flight review."""

from argparse import ArgumentParser
from pathlib import Path
import json
import sys


REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "backend"))

from app.config import DATABASE_PATH  # noqa: E402
from app.ml.snapshot import export_labeled_snapshot  # noqa: E402
from app.repositories import DemoRepository  # noqa: E402


def main() -> None:
    parser = ArgumentParser(description="导出预测—反馈训练标签快照")
    parser.add_argument(
        "--database",
        type=Path,
        default=DATABASE_PATH,
        help="SQLite 动态数据路径",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=REPO_ROOT / "data" / "runtime" / "training_snapshots",
        help="CSV 与元数据输出目录",
    )
    args = parser.parse_args()
    result = export_labeled_snapshot(
        DemoRepository(REPO_ROOT / "data", args.database),
        args.output_dir,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
