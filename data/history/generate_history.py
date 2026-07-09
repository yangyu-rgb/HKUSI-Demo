"""Generate deterministic hourly wait samples for the local statistical demo."""

from datetime import datetime, timedelta
from pathlib import Path
import csv
import math


OUTPUT = Path(__file__).with_name("port_wait_history.csv")
START = datetime(2026, 5, 14)
DAYS = 56
PORTS = {
    "罗湖": (18, 12),
    "福田": (12, 8),
    "皇岗": (30, 15),
    "深圳湾": (15, 9),
}
HOLIDAYS = {"2026-06-19", "2026-07-01"}


def wait_for(port_index: int, base: int, peak: int, moment: datetime, rain: bool) -> int:
    morning_peak = math.exp(-((moment.hour - 8.5) ** 2) / 3.2)
    evening_peak = math.exp(-((moment.hour - 18.0) ** 2) / 5.0)
    weekend_factor = 0.88 if moment.weekday() >= 5 else 1.0
    holiday_factor = 1.22 if moment.date().isoformat() in HOLIDAYS else 1.0
    weather_factor = 1.08 if rain else 1.0
    deterministic_noise = ((moment.toordinal() + moment.hour * 3 + port_index * 5) % 7) - 3
    value = (
        base
        + peak * morning_peak
        + peak * 0.65 * evening_peak
        + deterministic_noise
    )
    return max(2, round(value * weekend_factor * holiday_factor * weather_factor))


def main() -> None:
    with OUTPUT.open("w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file, lineterminator="\n")
        writer.writerow(
            ["timestamp", "port", "wait_minutes", "weather", "is_holiday", "crowd_level"]
        )
        for day_offset in range(DAYS):
            day = START + timedelta(days=day_offset)
            rain = day_offset % 5 == 2 or day_offset % 11 == 0
            for hour in range(24):
                moment = day.replace(hour=hour)
                for port_index, (port, (base, peak)) in enumerate(PORTS.items()):
                    wait = wait_for(port_index, base, peak, moment, rain)
                    crowd = "high" if wait >= 35 else "medium" if wait >= 18 else "low"
                    writer.writerow(
                        [
                            moment.isoformat(),
                            port,
                            wait,
                            "rain" if rain else "clear",
                            str(moment.date().isoformat() in HOLIDAYS).lower(),
                            crowd,
                        ]
                    )


if __name__ == "__main__":
    main()
