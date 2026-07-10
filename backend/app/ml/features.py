from datetime import datetime
from math import cos, pi, sin

import numpy as np

from .data import EXPECTED_PORTS, WaitRecord


FEATURE_NAMES = (
    "port_luohu",
    "port_futian",
    "port_huanggang",
    "port_shenzhen_bay",
    "hour_sin",
    "hour_cos",
    "weekday_sin",
    "weekday_cos",
    "is_weekend",
    "is_rain",
    "is_holiday",
)


def feature_vector(
    *,
    port: str,
    timestamp: datetime,
    weather: str,
    is_holiday: bool,
) -> list[float]:
    if port not in EXPECTED_PORTS:
        raise ValueError(f"不支持的口岸：{port}")
    hour = timestamp.hour + timestamp.minute / 60
    weekday = timestamp.weekday()
    port_features = [float(port == item) for item in EXPECTED_PORTS]
    return [
        *port_features,
        sin(2 * pi * hour / 24),
        cos(2 * pi * hour / 24),
        sin(2 * pi * weekday / 7),
        cos(2 * pi * weekday / 7),
        float(weekday >= 5),
        float(weather == "rain"),
        float(is_holiday),
    ]


def build_feature_matrix(records: tuple[WaitRecord, ...]) -> np.ndarray:
    return np.asarray(
        [
            feature_vector(
                port=record.port,
                timestamp=record.timestamp,
                weather=record.weather,
                is_holiday=record.is_holiday,
            )
            for record in records
        ],
        dtype=float,
    )


def build_target(records: tuple[WaitRecord, ...]) -> np.ndarray:
    return np.asarray([record.wait_minutes for record in records], dtype=float)
