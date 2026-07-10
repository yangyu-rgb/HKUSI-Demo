"""Governed official-feature collection without treating estimates as labels."""

from collections.abc import Callable
from datetime import datetime, timezone
from hashlib import sha256
from io import StringIO
from pathlib import Path
from typing import Any
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo
import csv
import json
import math


HONG_KONG_TIMEZONE = ZoneInfo("Asia/Hong_Kong")
SOURCE_STATUSES = {"candidate", "approved_feature_only", "approved_label", "blocked"}
PORT_CODE_MAP = {
    "LWS": "luohu",
    "LSC": "futian",
    "LMC": "huanggang",
    "SBC": "shenzhen-bay",
}
PORT_NAME_MAP = {
    "Lo Wu": "luohu",
    "Lok Ma Chau Spur Line": "futian",
    "Lok Ma Chau": "huanggang",
    "Shenzhen Bay": "shenzhen-bay",
}
DIRECTION_MAP = {
    "arrQueue": "shenzhen_to_hong_kong",
    "depQueue": "hong_kong_to_shenzhen",
    "Arrival": "shenzhen_to_hong_kong",
    "Departure": "hong_kong_to_shenzhen",
}
QUEUE_LEVELS = {
    0: ("normal", True),
    1: ("busy", True),
    2: ("very_busy", True),
    4: ("maintenance", False),
    99: ("non_service", False),
}
TRAFFIC_COLUMNS = {
    "Hong Kong Residents": "hong_kong_resident",
    "Mainland Visitors": "mainland_visitor",
    "Other Visitors": "other_visitor",
    "Total": "total",
}
EXACT_LABEL_REQUIRED_COLUMNS = {
    "record_id",
    "source_id",
    "source_version",
    "approval_batch_id",
    "port_id",
    "direction",
    "wait_started_at",
    "wait_ended_at",
    "actual_wait_minutes",
}
PROHIBITED_LABEL_COLUMNS = {"user_id", "name", "email", "phone", "document_number"}


def load_source_registry(path: Path) -> dict:
    payload = json.loads(path.read_text(encoding="utf-8"))
    sources = payload.get("sources")
    if payload.get("schema_version") != 1 or not isinstance(sources, list):
        raise ValueError("外部数据源登记表结构无效")
    ids: set[str] = set()
    required = {
        "id",
        "name",
        "provider",
        "status",
        "usage",
        "kind",
        "collection_enabled",
        "url",
        "source_version",
        "refresh_seconds",
        "attribution",
        "terms_url",
        "reason",
    }
    for source in sources:
        if not isinstance(source, dict) or not required <= set(source):
            raise ValueError("外部数据源登记项缺少必要字段")
        if source["id"] in ids or source["status"] not in SOURCE_STATUSES:
            raise ValueError("外部数据源 ID 重复或审批状态无效")
        if source["collection_enabled"] and source["status"] != "approved_feature_only":
            raise ValueError("只有已批准的特征来源可以启用自动采集")
        if source["status"] == "approved_label" and not source.get(
            "approved_label_batches"
        ):
            raise ValueError("标签来源必须登记至少一个批准批次")
        ids.add(source["id"])
    return payload


def source_by_id(registry: dict, source_id: str) -> dict:
    source = next(
        (item for item in registry["sources"] if item["id"] == source_id),
        None,
    )
    if source is None:
        raise ValueError(f"未知外部数据源：{source_id}")
    return source


def _observation(
    *,
    source: dict,
    fetched_at: datetime,
    observed_at: datetime,
    raw_hash: str,
    port_id: str,
    direction: str,
    traveler_category: str,
    metric_type: str,
    raw_value: float,
    congestion_level: str | None = None,
    feature_available: bool = True,
) -> dict:
    return {
        "source_id": source["id"],
        "source_version": source["source_version"],
        "fetched_at": fetched_at.astimezone(timezone.utc).isoformat(),
        "observed_at": observed_at.astimezone(timezone.utc).isoformat(),
        "port_id": port_id,
        "direction": direction,
        "traveler_category": traveler_category,
        "metric_type": metric_type,
        "raw_value": raw_value,
        "congestion_level": congestion_level,
        "feature_available": feature_available,
        "raw_hash": raw_hash,
    }


def normalize_queue_status(
    payload: dict,
    source: dict,
    fetched_at: datetime,
    raw_hash: str,
) -> list[dict]:
    traveler_category = source.get("traveler_category")
    if traveler_category not in {"hong_kong_resident", "visitor"}:
        raise ValueError("等候状态来源缺少有效旅客类别")
    observations = []
    for code, port_id in PORT_CODE_MAP.items():
        values = payload.get(code)
        if not isinstance(values, dict):
            raise ValueError(f"官方等候状态缺少口岸：{code}")
        for field in ("arrQueue", "depQueue"):
            status_code = values.get(field)
            if status_code not in QUEUE_LEVELS:
                raise ValueError(f"官方等候状态码无效：{code}.{field}")
            congestion_level, feature_available = QUEUE_LEVELS[status_code]
            observations.append(
                _observation(
                    source=source,
                    fetched_at=fetched_at,
                    observed_at=fetched_at,
                    raw_hash=raw_hash,
                    port_id=port_id,
                    direction=DIRECTION_MAP[field],
                    traveler_category=traveler_category,
                    metric_type="queue_status",
                    raw_value=float(status_code),
                    congestion_level=congestion_level,
                    feature_available=feature_available,
                )
            )
    return observations


def normalize_daily_traffic(
    csv_text: str,
    source: dict,
    fetched_at: datetime,
    raw_hash: str,
) -> list[dict]:
    reader = csv.DictReader(StringIO(csv_text.lstrip("\ufeff")))
    required = {"Date", "Control Point", "Arrival / Departure", *TRAFFIC_COLUMNS}
    if reader.fieldnames is None or not required <= set(reader.fieldnames):
        raise ValueError("每日客流 CSV 缺少必要字段")
    observations = []
    for row in reader:
        port_id = PORT_NAME_MAP.get(row["Control Point"])
        direction = DIRECTION_MAP.get(row["Arrival / Departure"])
        if port_id is None or direction is None:
            continue
        service_date = datetime.strptime(row["Date"], "%d-%m-%Y").replace(
            tzinfo=HONG_KONG_TIMEZONE
        )
        for column, traveler_category in TRAFFIC_COLUMNS.items():
            try:
                count = int(row[column].replace(",", ""))
            except (AttributeError, ValueError) as error:
                raise ValueError(f"每日客流数值无效：{row['Date']} {column}") from error
            observations.append(
                _observation(
                    source=source,
                    fetched_at=fetched_at,
                    observed_at=service_date,
                    raw_hash=raw_hash,
                    port_id=port_id,
                    direction=direction,
                    traveler_category=traveler_category,
                    metric_type="passenger_count",
                    raw_value=float(count),
                )
            )
    if not observations:
        raise ValueError("每日客流 CSV 没有四个目标口岸的数据")
    return observations


def fetch_url(url: str, timeout_seconds: int = 20) -> bytes:
    request = Request(url, headers={"User-Agent": "CrossBorder-AI-Demo/1.0"})
    with urlopen(request, timeout=timeout_seconds) as response:
        return response.read()


class OfficialDataCollector:
    def __init__(
        self,
        *,
        registry: dict,
        repository: Any,
        archive_dir: Path,
        clock: Callable[[], datetime],
        fetcher: Callable[[str], bytes] = fetch_url,
    ):
        self._registry = registry
        self._repository = repository
        self._archive_dir = archive_dir
        self._clock = clock
        self._fetcher = fetcher

    def collect(self, source_id: str) -> dict:
        source = source_by_id(self._registry, source_id)
        if not source["collection_enabled"] or source["status"] != "approved_feature_only":
            raise ValueError(f"数据源未获准采集：{source_id}")
        fetched_at = self._clock().astimezone(timezone.utc).replace(microsecond=0)
        try:
            raw = self._fetcher(source["url"])
            raw_hash = sha256(raw).hexdigest()
            archive_path = self._archive(source, fetched_at, raw, raw_hash)
            if source["kind"] == "queue_status_json":
                payload = json.loads(raw.decode("utf-8-sig"))
                observations = normalize_queue_status(
                    payload, source, fetched_at, raw_hash
                )
            elif source["kind"] == "daily_traffic_csv":
                observations = normalize_daily_traffic(
                    raw.decode("utf-8-sig"), source, fetched_at, raw_hash
                )
            else:
                raise ValueError(f"不支持的采集类型：{source['kind']}")
            saved = self._repository.save_collection(
                source=source,
                fetched_at=fetched_at.isoformat(),
                raw_hash=raw_hash,
                archive_path=str(archive_path),
                observations=observations,
            )
            return {
                "source_id": source_id,
                "status": "success",
                "observation_count": len(observations),
                "saved_observation_count": saved,
                "raw_hash": raw_hash,
                "archive_path": str(archive_path),
                "fetched_at": fetched_at.isoformat(),
            }
        except Exception as error:
            self._repository.record_failure(
                source=source,
                fetched_at=fetched_at.isoformat(),
                error=str(error),
            )
            raise

    def _archive(
        self,
        source: dict,
        fetched_at: datetime,
        raw: bytes,
        raw_hash: str,
    ) -> Path:
        suffix = ".json" if source["kind"] == "queue_status_json" else ".csv"
        directory = self._archive_dir / source["id"] / fetched_at.strftime("%Y-%m-%d")
        directory.mkdir(parents=True, exist_ok=True)
        path = directory / f"{fetched_at.strftime('%H%M%S')}-{raw_hash[:12]}{suffix}"
        if not path.exists():
            path.write_bytes(raw)
        return path


def validate_exact_wait_csv(csv_text: str, registry: dict) -> dict:
    reader = csv.DictReader(StringIO(csv_text.lstrip("\ufeff")))
    fieldnames = set(reader.fieldnames or [])
    missing = EXACT_LABEL_REQUIRED_COLUMNS - fieldnames
    if missing:
        return {
            "valid": False,
            "record_count": 0,
            "errors": [{"row": 1, "message": f"缺少列：{', '.join(sorted(missing))}"}],
        }
    prohibited = PROHIBITED_LABEL_COLUMNS & fieldnames
    if prohibited:
        return {
            "valid": False,
            "record_count": 0,
            "errors": [
                {"row": 1, "message": f"禁止直接身份字段：{', '.join(sorted(prohibited))}"}
            ],
        }
    errors = []
    record_count = 0
    record_ids: set[str] = set()
    valid_ports = set(PORT_CODE_MAP.values())
    valid_directions = {
        "hong_kong_to_shenzhen",
        "shenzhen_to_hong_kong",
    }
    for row_number, row in enumerate(reader, start=2):
        record_count += 1
        try:
            source = source_by_id(registry, row["source_id"])
            if source["status"] != "approved_label":
                raise ValueError("来源未获准作为精确分钟标签")
            if row["source_version"] != source["source_version"]:
                raise ValueError("来源版本与登记表不一致")
            if row["approval_batch_id"] not in source.get("approved_label_batches", []):
                raise ValueError("批准批次 ID 未在来源登记表中")
            if not row["record_id"].strip() or row["record_id"] in record_ids:
                raise ValueError("记录 ID 为空或重复")
            if row["port_id"] not in valid_ports:
                raise ValueError("口岸 ID 不在 V2 四口岸范围")
            if row["direction"] not in valid_directions:
                raise ValueError("通勤方向无效")
            started = datetime.fromisoformat(row["wait_started_at"])
            ended = datetime.fromisoformat(row["wait_ended_at"])
            if started.tzinfo is None or ended.tzinfo is None or ended <= started:
                raise ValueError("等待起止时间必须带时区且结束晚于开始")
            actual = float(row["actual_wait_minutes"])
            duration = (ended - started).total_seconds() / 60
            if not math.isfinite(actual) or actual < 0 or abs(actual - duration) > 1:
                raise ValueError("实际等待分钟与起止时间不一致")
            record_ids.add(row["record_id"])
        except (ValueError, TypeError) as error:
            errors.append({"row": row_number, "message": str(error)})
    return {
        "valid": record_count > 0 and not errors,
        "record_count": record_count,
        "errors": errors,
    }
