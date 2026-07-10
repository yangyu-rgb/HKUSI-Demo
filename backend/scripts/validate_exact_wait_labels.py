"""Validate a candidate exact-wait CSV without importing or mutating labels."""

from pathlib import Path
import argparse
import json
import sys


BACKEND_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.config import DATA_DIR  # noqa: E402
from app.external_data import load_source_registry, validate_exact_wait_csv  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(
        description="只读校验候选精确等待标签；不会写入数据库或训练快照。"
    )
    parser.add_argument("csv_path", type=Path)
    parser.add_argument(
        "--registry",
        type=Path,
        default=DATA_DIR / "sources" / "official_sources.json",
    )
    args = parser.parse_args()
    registry = load_source_registry(args.registry)
    result = validate_exact_wait_csv(
        args.csv_path.read_text(encoding="utf-8-sig"),
        registry,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["valid"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
