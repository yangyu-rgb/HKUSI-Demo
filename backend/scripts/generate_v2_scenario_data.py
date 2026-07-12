"""Generate deterministic AI v2.1 labels from a tracked official traffic snapshot."""

from argparse import ArgumentParser
from datetime import datetime
from hashlib import sha256
from pathlib import Path
from statistics import median
import csv
import json
import math
import random


ROOT = Path(__file__).resolve().parents[2]
SNAPSHOT = ROOT / "data/history/public_port_traffic_daily.csv"
SNAPSHOT_METADATA = ROOT / "data/history/public_port_traffic_daily.metadata.json"
OUTPUT = ROOT / "data/runtime/training_snapshots/scenario_wait_history_v2.csv"
OUTPUT_METADATA = ROOT / "data/runtime/training_snapshots/scenario_wait_history_v2.metadata.json"
DAYS = 730
WARMUP_DAYS = 56
PORTS = {"罗湖": ("luohu", 18, 13), "福田": ("futian", 13, 10), "皇岗": ("huanggang", 27, 15), "深圳湾": ("shenzhen-bay", 16, 9)}
DIRECTIONS = ("hong_kong_to_shenzhen", "shenzhen_to_hong_kong")
WEATHERS = ("clear", "rain", "heavy_rain", "thunderstorm")
IMPACTS = ("none", "low", "medium", "high")
WEATHER_FACTOR = {"clear": 1.0, "rain": 1.08, "heavy_rain": 1.18, "thunderstorm": 1.25}
EVENT_FACTOR = {"none": 1.0, "low": 1.08, "medium": 1.20, "high": 1.38}
FORMULA_VERSION = "public-traffic-scenario-formula-v2.1"


def parse_args():
    parser = ArgumentParser()
    parser.add_argument("--snapshot", type=Path, default=SNAPSHOT)
    parser.add_argument("--snapshot-metadata", type=Path, default=SNAPSHOT_METADATA)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--metadata", type=Path, default=OUTPUT_METADATA)
    return parser.parse_args()


def load_public_traffic(path: Path, metadata_path: Path) -> tuple[dict[tuple[str, str, str], int], dict]:
    metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
    if metadata.get("sha256") != sha256(path.read_bytes()).hexdigest():
        raise SystemExit("官方客流快照哈希与元数据不一致。")
    rows = list(csv.DictReader(path.open(encoding="utf-8")))
    traffic: dict[tuple[str, str, str], int] = {}
    for row in rows:
        key = (row["service_date"], row["port_id"], row["direction"])
        if key in traffic or int(row["passenger_count"]) < 0:
            raise SystemExit("官方客流快照包含重复键或负数。")
        traffic[key] = int(row["passenger_count"])
    return traffic, metadata


def wait_minutes(*, port_index: int, base: int, peak: int, moment: datetime, direction: str, weather: str, holiday: bool, impact: str, traffic_pressure: float) -> int:
    morning_center = 8.3 if direction == "hong_kong_to_shenzhen" else 9.2
    evening_center = 18.0 if direction == "shenzhen_to_hong_kong" else 17.4
    morning = math.exp(-((moment.hour - morning_center) ** 2) / 3.0)
    evening = math.exp(-((moment.hour - evening_center) ** 2) / 4.5)
    weekend = 0.9 if moment.weekday() >= 5 else 1.0
    holiday_factor = 1.24 if holiday else 1.0
    direction_factor = 1.07 if direction == "shenzhen_to_hong_kong" and moment.hour >= 16 else 1.0
    interaction = 1.04 if impact != "none" and weather in {"heavy_rain", "thunderstorm"} else 1.0
    noise = random.Random(f"{FORMULA_VERSION}-{moment.isoformat()}-{port_index}-{direction}-{weather}-{impact}").uniform(-2.2, 2.2)
    traffic_factor = max(0.85, min(1.30, 1 + 0.35 * (traffic_pressure - 1)))
    value = base + peak * morning + peak * 0.72 * evening + noise
    return max(2, round(value * weekend * holiday_factor * direction_factor * WEATHER_FACTOR[weather] * EVENT_FACTOR[impact] * interaction * traffic_factor))


def main() -> None:
    args = parse_args()
    traffic, snapshot_metadata = load_public_traffic(args.snapshot, args.snapshot_metadata)
    port_ids = [item[0] for item in PORTS.values()]
    complete_dates = sorted({day for day, _, _ in traffic if all((day, port_id, direction) in traffic for port_id in port_ids for direction in DIRECTIONS)})
    if len(complete_dates) < DAYS + WARMUP_DAYS:
        raise SystemExit(f"官方客流完整日期不足 {DAYS + WARMUP_DAYS} 天。")
    selected_dates = complete_dates[-DAYS:]
    histories = {
        (port_id, direction): [(day, traffic[(day, port_id, direction)]) for day in complete_dates]
        for port_id in port_ids for direction in DIRECTIONS
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    fields = ["timestamp", "port", "direction", "weather", "is_holiday", "event_impact", "passenger_count", "raw_traffic_pressure", "traffic_pressure", "traffic_available", "traffic_source", "wait_minutes"]
    row_count = 0
    with args.output.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        for day_offset, day_text in enumerate(selected_dates):
            day = datetime.fromisoformat(day_text)
            holiday = day_offset % 29 == 0 or day_offset % 47 == 0
            for hour in range(24):
                moment = day.replace(hour=hour)
                for port_index, (port, (port_id, base, peak)) in enumerate(PORTS.items()):
                    for direction_index, direction in enumerate(DIRECTIONS):
                        count = traffic[(day_text, port_id, direction)]
                        previous = [value for candidate, value in histories[(port_id, direction)] if candidate < day_text][-WARMUP_DAYS:]
                        if len(previous) < WARMUP_DAYS:
                            raise SystemExit(f"{day_text} 缺少56天历史预热：{port_id}/{direction}")
                        raw_pressure = count / max(1, median(previous))
                        pressure = max(0.6, min(1.8, raw_pressure))
                        weather = WEATHERS[(day_offset + direction_index) % len(WEATHERS)]
                        impact = IMPACTS[(day_offset * 3 + hour + port_index + direction_index) % len(IMPACTS)]
                        writer.writerow({
                            "timestamp": moment.isoformat(), "port": port, "direction": direction,
                            "weather": weather, "is_holiday": str(holiday).lower(), "event_impact": impact,
                            "passenger_count": count, "raw_traffic_pressure": round(raw_pressure, 6), "traffic_pressure": round(pressure, 6),
                            "traffic_available": "true", "traffic_source": snapshot_metadata["source_id"],
                            "wait_minutes": wait_minutes(port_index=port_index, base=base, peak=peak, moment=moment, direction=direction, weather=weather, holiday=holiday, impact=impact, traffic_pressure=pressure),
                        })
                        row_count += 1
    digest = sha256(args.output.read_bytes()).hexdigest()
    output_label = str(args.output.relative_to(ROOT)) if args.output.is_relative_to(ROOT) else str(args.output)
    snapshot_label = str(args.snapshot.relative_to(ROOT)) if args.snapshot.is_relative_to(ROOT) else str(args.snapshot)
    metadata = {
        "schema_version": 1,
        "formula_version": FORMULA_VERSION,
        "dataset": {"path": output_label, "sha256": digest, "sample_count": row_count, "start": selected_dates[0], "end": selected_dates[-1]},
        "source_snapshot": {"path": snapshot_label, "sha256": snapshot_metadata["sha256"], "source_id": snapshot_metadata["source_id"], "start": snapshot_metadata["start"], "end": snapshot_metadata["end"]},
        "audit": {"passed": True, "complete_dates": len(selected_dates), "warmup_days": WARMUP_DAYS, "duplicate_keys": 0, "missing_target_cells": 0, "negative_counts": 0, "future_rows_used": 0},
        "coefficients": {"traffic_slope": 0.35, "traffic_pressure_bounds": [0.6, 1.8], "traffic_multiplier_bounds": [0.85, 1.30], "weather": WEATHER_FACTOR, "event": EVENT_FACTOR},
    }
    args.metadata.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"generated={args.output}\nmetadata={args.metadata}\nrows={row_count}")


if __name__ == "__main__":
    main()
