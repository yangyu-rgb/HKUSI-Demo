from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
import csv
import hashlib


EXPECTED_PORTS = ("罗湖", "福田", "皇岗", "深圳湾")
ALLOWED_WEATHER = {"clear", "rain"}
REQUIRED_COLUMNS = {
    "timestamp",
    "port",
    "wait_minutes",
    "weather",
    "is_holiday",
}


@dataclass(frozen=True)
class WaitRecord:
    timestamp: datetime
    port: str
    wait_minutes: float
    weather: str
    is_holiday: bool


@dataclass(frozen=True)
class DatasetSplit:
    train: tuple[WaitRecord, ...]
    validation: tuple[WaitRecord, ...]
    test: tuple[WaitRecord, ...]
    train_dates: tuple[date, date]
    validation_dates: tuple[date, date]
    test_dates: tuple[date, date]


def dataset_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _parse_boolean(value: str, row_number: int) -> bool:
    normalized = value.strip().lower()
    if normalized not in {"true", "false"}:
        raise ValueError(f"第{row_number}行 is_holiday 必须为 true 或 false")
    return normalized == "true"


def load_wait_history(path: Path) -> tuple[WaitRecord, ...]:
    with path.open("r", encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file)
        columns = set(reader.fieldnames or [])
        missing_columns = REQUIRED_COLUMNS - columns
        if missing_columns:
            raise ValueError(f"历史数据缺少字段：{sorted(missing_columns)}")

        records: list[WaitRecord] = []
        seen_keys: set[tuple[datetime, str]] = set()
        for row_number, row in enumerate(reader, start=2):
            try:
                timestamp = datetime.fromisoformat(row["timestamp"])
                wait_minutes = float(row["wait_minutes"])
            except (TypeError, ValueError) as error:
                raise ValueError(f"第{row_number}行时间或等待分钟无效") from error
            port = row["port"].strip()
            weather = row["weather"].strip().lower()
            if port not in EXPECTED_PORTS:
                raise ValueError(f"第{row_number}行包含未知口岸：{port}")
            if weather not in ALLOWED_WEATHER:
                raise ValueError(f"第{row_number}行包含未知天气：{weather}")
            if not 0 <= wait_minutes <= 180:
                raise ValueError(f"第{row_number}行等待分钟超出 0–180 范围")
            key = (timestamp, port)
            if key in seen_keys:
                raise ValueError(f"历史数据包含重复键：{timestamp.isoformat()} / {port}")
            seen_keys.add(key)
            records.append(
                WaitRecord(
                    timestamp=timestamp,
                    port=port,
                    wait_minutes=wait_minutes,
                    weather=weather,
                    is_holiday=_parse_boolean(row["is_holiday"], row_number),
                )
            )

    if not records:
        raise ValueError("历史数据为空")
    records.sort(key=lambda item: (item.timestamp, EXPECTED_PORTS.index(item.port)))
    timestamps = sorted({record.timestamp for record in records})
    for previous, current in zip(timestamps, timestamps[1:]):
        if current - previous != timedelta(hours=1):
            raise ValueError(
                f"历史时间不连续：{previous.isoformat()} 后为 {current.isoformat()}"
            )
    ports_by_timestamp: dict[datetime, set[str]] = {}
    for record in records:
        ports_by_timestamp.setdefault(record.timestamp, set()).add(record.port)
    expected = set(EXPECTED_PORTS)
    incomplete = [
        timestamp
        for timestamp, ports in ports_by_timestamp.items()
        if ports != expected
    ]
    if incomplete:
        raise ValueError(f"存在未覆盖四口岸的时间点：{incomplete[0].isoformat()}")
    return tuple(records)


def split_chronologically(
    records: tuple[WaitRecord, ...],
    *,
    train_days: int = 39,
    validation_days: int = 8,
) -> DatasetSplit:
    dates = sorted({record.timestamp.date() for record in records})
    if len(dates) <= train_days + validation_days:
        raise ValueError("历史天数不足，无法保留独立测试集")
    train_date_set = set(dates[:train_days])
    validation_date_set = set(dates[train_days : train_days + validation_days])
    test_date_set = set(dates[train_days + validation_days :])
    train = tuple(record for record in records if record.timestamp.date() in train_date_set)
    validation = tuple(
        record for record in records if record.timestamp.date() in validation_date_set
    )
    test = tuple(record for record in records if record.timestamp.date() in test_date_set)
    return DatasetSplit(
        train=train,
        validation=validation,
        test=test,
        train_dates=(min(train_date_set), max(train_date_set)),
        validation_dates=(min(validation_date_set), max(validation_date_set)),
        test_dates=(min(test_date_set), max(test_date_set)),
    )
