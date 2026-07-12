"""Export the governed official daily traffic feature snapshot for AI v2.1."""

from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from zoneinfo import ZoneInfo
import argparse
import csv
import json
import sqlite3


ROOT = Path(__file__).resolve().parents[2]
DATABASE = ROOT / "data/runtime/crossborder.db"
OUTPUT = ROOT / "data/history/public_port_traffic_daily.csv"
METADATA = ROOT / "data/history/public_port_traffic_daily.metadata.json"
PORTS = {"luohu", "futian", "huanggang", "shenzhen-bay"}
DIRECTIONS = {"hong_kong_to_shenzhen", "shenzhen_to_hong_kong"}
SOURCE_ID = "hk_immd_daily_passenger_traffic"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="导出 AI v2.1 使用的官方每日口岸客流快照。")
    parser.add_argument("--database", type=Path, default=DATABASE)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--metadata", type=Path, default=METADATA)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    connection = sqlite3.connect(args.database)
    connection.row_factory = sqlite3.Row
    rows = connection.execute(
        """SELECT observed_at, port_id, direction, raw_value, source_version,
                  first_fetched_at, raw_hash
           FROM external_feature_observations
           WHERE source_id = ? AND metric_type = 'passenger_count'
             AND traveler_category = 'total' AND feature_available = 1
           ORDER BY observed_at, port_id, direction""",
        (SOURCE_ID,),
    ).fetchall()
    connection.close()
    normalized = []
    for row in rows:
        service_date = datetime.fromisoformat(row["observed_at"]).astimezone(
            ZoneInfo("Asia/Hong_Kong")
        ).date().isoformat()
        if row["port_id"] not in PORTS or row["direction"] not in DIRECTIONS:
            continue
        normalized.append(
            {
                "service_date": service_date,
                "port_id": row["port_id"],
                "direction": row["direction"],
                "passenger_count": int(row["raw_value"]),
                "source_id": SOURCE_ID,
                "source_version": row["source_version"],
                "known_at": row["first_fetched_at"],
                "raw_hash": row["raw_hash"],
            }
        )
    keys = {(row["service_date"], row["port_id"], row["direction"]) for row in normalized}
    if len(keys) != len(normalized) or any(row["passenger_count"] < 0 for row in normalized):
        raise SystemExit("官方客流快照包含重复键或负数。")
    dates = sorted({row["service_date"] for row in normalized})
    complete_dates = [
        day for day in dates
        if all((day, port, direction) in keys for port in PORTS for direction in DIRECTIONS)
    ]
    if len(complete_dates) < 786:
        raise SystemExit("完整官方客流日期不足 786 天，无法生成730天模型集及56天预热。")
    args.output.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "service_date", "port_id", "direction", "passenger_count",
        "source_id", "source_version", "known_at", "raw_hash",
    ]
    with args.output.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames, lineterminator="\n")
        writer.writeheader()
        writer.writerows(normalized)
    digest = sha256(args.output.read_bytes()).hexdigest()
    metadata = {
        "schema_version": 1,
        "source_id": SOURCE_ID,
        "source_url": "https://www.immd.gov.hk/opendata/eng/transport/immigration_clearance/statistics_on_daily_passenger_traffic.csv",
        "attribution": "香港特别行政区政府入境事务处、DATA.GOV.HK",
        "exported_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "path": str(args.output.relative_to(ROOT)),
        "sha256": digest,
        "row_count": len(normalized),
        "complete_date_count": len(complete_dates),
        "start": dates[0],
        "end": dates[-1],
        "ports": sorted(PORTS),
        "directions": sorted(DIRECTIONS),
    }
    args.metadata.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"snapshot={args.output}\nmetadata={args.metadata}\nrows={len(normalized)}")


if __name__ == "__main__":
    main()
