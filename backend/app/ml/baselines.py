from collections import defaultdict
from statistics import fmean

import numpy as np

from .data import EXPECTED_PORTS, WaitRecord


def _hour_distance(left: int, right: int) -> int:
    difference = abs(left - right)
    return min(difference, 24 - difference)


class CalendarMeanBaseline:
    def __init__(self) -> None:
        self._records: tuple[WaitRecord, ...] = ()
        self._port_means: dict[str, float] = {}

    def fit(self, records: tuple[WaitRecord, ...]) -> "CalendarMeanBaseline":
        if not records:
            raise ValueError("基线训练数据为空")
        self._records = records
        grouped: dict[str, list[float]] = defaultdict(list)
        for record in records:
            grouped[record.port].append(record.wait_minutes)
        self._port_means = {port: fmean(values) for port, values in grouped.items()}
        return self

    def predict(self, records: tuple[WaitRecord, ...]) -> np.ndarray:
        if not self._records:
            raise RuntimeError("基线尚未训练")
        predictions = []
        for target in records:
            weekday_group = target.timestamp.weekday() < 5
            candidates = [
                record
                for record in self._records
                if record.port == target.port
                and (record.timestamp.weekday() < 5) == weekday_group
                and _hour_distance(record.timestamp.hour, target.timestamp.hour) <= 1
            ]
            weather_candidates = [
                record for record in candidates if record.weather == target.weather
            ]
            if len(weather_candidates) >= 6:
                candidates = weather_candidates
            holiday_candidates = [
                record
                for record in candidates
                if record.is_holiday == target.is_holiday
            ]
            if len(holiday_candidates) >= 6:
                candidates = holiday_candidates
            if candidates:
                predictions.append(fmean(record.wait_minutes for record in candidates))
            else:
                predictions.append(self._port_means.get(target.port, 0.0))
        return np.asarray(predictions, dtype=float)
