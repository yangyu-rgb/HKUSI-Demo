from hashlib import sha256
import json
from pathlib import Path
from statistics import median


PORT_IDS = {
    "罗湖": "luohu",
    "福田": "futian",
    "皇岗": "huanggang",
    "深圳湾": "shenzhen-bay",
}


def cross_source_validation(
    path: Path,
    *,
    port_name: str,
    hong_kong_pressure: float,
) -> dict:
    """Compare normalized public signals without summing duplicate travelers."""
    try:
        raw = path.read_bytes()
        payload = json.loads(raw)
        port_id = PORT_IDS[port_name]
        values = [
            int(record["ports"][port_id])
            for record in payload["records"]
            if port_id in record.get("ports", {})
        ]
        if len(values) < 2 or any(value <= 0 for value in values):
            raise ValueError("reference coverage is insufficient")
        latest = next(
            record for record in reversed(payload["records"])
            if port_id in record.get("ports", {})
        )
        baseline = float(median(values))
        shenzhen_pressure = int(latest["ports"][port_id]) / baseline
        denominator = max(abs(float(hong_kong_pressure)), abs(shenzhen_pressure), 0.01)
        disagreement = min(1.0, abs(float(hong_kong_pressure) - shenzhen_pressure) / denominator)
        uncertainty_multiplier = 1 + min(0.35, disagreement)
        return {
            "available": True,
            "provider": payload["provider"],
            "purpose": payload["purpose"],
            "source_url": latest["source_url"],
            "published_at": latest["published_at"],
            "metric_type": latest["metric_type"],
            "reference_count": int(latest["ports"][port_id]),
            "baseline_count": round(baseline),
            "pressure": round(shenzhen_pressure, 4),
            "hong_kong_pressure": round(float(hong_kong_pressure), 4),
            "agreement_percent": round((1 - disagreement) * 100, 1),
            "uncertainty_multiplier": round(uncertainty_multiplier, 4),
            "snapshot_sha256": sha256(raw).hexdigest(),
            "point_prediction_adjustment_minutes": 0.0,
            "reason": "深圳公开快照只核验来源一致性，不与香港客流重复相加。",
        }
    except Exception:
        return {
            "available": False,
            "agreement_percent": None,
            "uncertainty_multiplier": 1.0,
            "point_prediction_adjustment_minutes": 0.0,
            "reason": "深圳官方核验快照缺失或无足够覆盖。",
        }
