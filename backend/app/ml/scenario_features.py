from datetime import datetime
from math import cos, pi, sin


PORTS = ("罗湖", "福田", "皇岗", "深圳湾")
DIRECTIONS = ("hong_kong_to_shenzhen", "shenzhen_to_hong_kong")
WEATHER_TYPES = ("clear", "rain", "heavy_rain", "thunderstorm")
EVENT_IMPACTS = {"none": 0.0, "low": 1.0, "medium": 2.0, "high": 3.0}

FEATURE_NAMES = (
    "port_luohu", "port_futian", "port_huanggang", "port_shenzhen_bay",
    "direction_hk_to_sz", "direction_sz_to_hk",
    "hour_sin", "hour_cos", "weekday_sin", "weekday_cos",
    "is_weekend",
    "traffic_pressure", "traffic_available",
)


def scenario_feature_vector(
    *,
    port: str,
    direction: str,
    timestamp: datetime,
    weather: str,
    is_holiday: bool,
    event_impact: str,
    traffic_pressure: float = 1.0,
    traffic_available: bool = False,
) -> list[float]:
    if port not in PORTS:
        raise ValueError(f"不支持的口岸：{port}")
    if direction not in DIRECTIONS:
        raise ValueError(f"不支持的方向：{direction}")
    if weather not in WEATHER_TYPES:
        raise ValueError(f"不支持的天气：{weather}")
    if event_impact not in EVENT_IMPACTS:
        raise ValueError(f"不支持的事件强度：{event_impact}")
    hour = timestamp.hour + timestamp.minute / 60
    weekday = timestamp.weekday()
    return [
        *[float(port == item) for item in PORTS],
        *[float(direction == item) for item in DIRECTIONS],
        sin(2 * pi * hour / 24), cos(2 * pi * hour / 24),
        sin(2 * pi * weekday / 7), cos(2 * pi * weekday / 7),
        float(weekday >= 5),
        max(0.6, min(1.8, float(traffic_pressure))),
        float(traffic_available),
    ]
