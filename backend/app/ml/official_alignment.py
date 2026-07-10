"""Compare V1 statistical waits with official ordinal states without pseudo-minutes."""

from collections import defaultdict
from datetime import datetime


PORT_NAMES = {
    "luohu": "罗湖",
    "futian": "福田",
    "huanggang": "皇岗",
    "shenzhen-bay": "深圳湾",
}
LEVEL_ORDINAL = {"normal": 0, "busy": 1, "very_busy": 2}


def _predicted_level(minutes: float, traveler_category: str) -> str:
    if traveler_category == "hong_kong_resident":
        return "normal" if minutes < 15 else "busy" if minutes < 30 else "very_busy"
    return "normal" if minutes < 30 else "busy" if minutes < 45 else "very_busy"


def _summary(rows: list[dict]) -> dict:
    if not rows:
        return {"sample_count": 0, "agreement_percent": None, "mean_ordinal_error": None}
    return {
        "sample_count": len(rows),
        "agreement_percent": round(
            sum(row["official_level"] == row["predicted_level"] for row in rows)
            / len(rows) * 100,
            2,
        ),
        "mean_ordinal_error": round(
            sum(
                abs(
                    LEVEL_ORDINAL[row["official_level"]]
                    - LEVEL_ORDINAL[row["predicted_level"]]
                )
                for row in rows
            ) / len(rows),
            3,
        ),
    }


def assess_official_alignment(repository) -> dict:
    # Import lazily so the standalone snapshot exporter does not create
    # snapshot -> services package -> DemoService -> snapshot at module load.
    from ..services.wait_forecast import WaitForecastService

    revisions = repository.external_data.list_queue_observations()
    latest: dict[tuple, dict] = {}
    for row in revisions:
        key = (
            row["source_id"], row["observed_at"], row["port_id"],
            row["direction"], row["traveler_category"],
        )
        latest[key] = row
    forecast = WaitForecastService(repository, repository.clock)
    comparisons = []
    for row in latest.values():
        if row["congestion_level"] not in LEVEL_ORDINAL:
            continue
        observed_at = datetime.fromisoformat(row["observed_at"])
        estimate = forecast.estimate(
            PORT_NAMES[row["port_id"]],
            observed_at,
            observed_at,
            [],
        )
        comparisons.append(
            {
                "port_id": row["port_id"],
                "direction": row["direction"],
                "traveler_category": row["traveler_category"],
                "hour": observed_at.astimezone(repository.clock.now().tzinfo).hour,
                "official_level": row["congestion_level"],
                "predicted_level": _predicted_level(
                    estimate["value"], row["traveler_category"]
                ),
            }
        )
    groups: dict[str, dict[str, list[dict]]] = {
        "by_port": defaultdict(list),
        "by_direction": defaultdict(list),
        "by_traveler_category": defaultdict(list),
        "by_hour": defaultdict(list),
    }
    for row in comparisons:
        groups["by_port"][row["port_id"]].append(row)
        groups["by_direction"][row["direction"]].append(row)
        groups["by_traveler_category"][row["traveler_category"]].append(row)
        groups["by_hour"][str(row["hour"])].append(row)
    confusion: dict[str, int] = {}
    for row in comparisons:
        key = f"{row['official_level']}->{row['predicted_level']}"
        confusion[key] = confusion.get(key, 0) + 1
    return {
        "status": "available" if comparisons else "not_enough_data",
        "metric_type": "ordinal_category_only",
        **_summary(comparisons),
        "confusion_matrix": confusion,
        **{
            name: {key: _summary(values) for key, values in sorted(group.items())}
            for name, group in groups.items()
        },
        "limitations": [
            "官方等级不转换为等待分钟，报告不计算分钟 MAE。",
            "当前统计模型没有方向特征，方向切片只用于暴露差异。",
        ],
    }
