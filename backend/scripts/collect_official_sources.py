"""Collect approved official feature sources into the governed local archive."""

from pathlib import Path
import argparse
import json
import sys
import time


BACKEND_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = BACKEND_DIR.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.clock import HongKongClock  # noqa: E402
from app.config import DATA_DIR, DATABASE_PATH, RUNTIME_DIR  # noqa: E402
from app.external_data import OfficialDataCollector, load_source_registry  # noqa: E402
from app.repositories import DemoRepository  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="采集已批准的官方拥堵等级与客流特征，不生成等待分钟标签。"
    )
    parser.add_argument(
        "--source",
        action="append",
        dest="sources",
        help="仅采集指定 source ID；可重复使用。默认采集所有已启用来源。",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=None,
        help="持续运行时的检查间隔秒数；省略则只执行一次。",
    )
    parser.add_argument(
        "--status",
        action="store_true",
        help="只读输出采集覆盖和来源新鲜度，不执行网络请求。",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if args.interval is not None and args.interval < 60:
        raise SystemExit("--interval 不能小于 60 秒")
    clock = HongKongClock()
    registry = load_source_registry(DATA_DIR / "sources" / "official_sources.json")
    enabled = [
        source
        for source in registry["sources"]
        if source["collection_enabled"]
        and (args.sources is None or source["id"] in args.sources)
    ]
    if args.sources:
        missing = set(args.sources) - {source["id"] for source in enabled}
        if missing:
            raise SystemExit(f"数据源不存在或未批准采集：{', '.join(sorted(missing))}")
    repository = DemoRepository(DATA_DIR, DATABASE_PATH, clock)
    if args.status:
        print(json.dumps(repository.external_data.readiness(), ensure_ascii=False, indent=2))
        return 0
    collector = OfficialDataCollector(
        registry=registry,
        repository=repository.external_data,
        archive_dir=RUNTIME_DIR / "external_sources",
        clock=clock.now,
    )
    last_collected: dict[str, float] = {}
    failures = 0
    while True:
        now = time.monotonic()
        for source in enabled:
            elapsed = now - last_collected.get(source["id"], float("-inf"))
            if elapsed < source["refresh_seconds"]:
                continue
            try:
                result = collector.collect(source["id"])
                print(json.dumps(result, ensure_ascii=False))
            except Exception as error:
                failures += 1
                print(
                    json.dumps(
                        {
                            "source_id": source["id"],
                            "status": "failed",
                            "error": str(error),
                        },
                        ensure_ascii=False,
                    ),
                    file=sys.stderr,
                )
            last_collected[source["id"]] = now
        if args.interval is None:
            return 1 if failures else 0
        time.sleep(args.interval)


if __name__ == "__main__":
    raise SystemExit(main())
