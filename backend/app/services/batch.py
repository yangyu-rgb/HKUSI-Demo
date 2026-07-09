from datetime import datetime, timedelta

from ..repositories import DemoRepository
from ..schemas.batch import BatchRequest
from ..schemas.prediction import PredictionPreferences, PredictionRequest
from .prediction import PredictionService


ORIGIN_IDS = {
    "香港大学": "hku",
    "中环": "central",
    "九龙塘": "kowloon-tong",
}


def destination_id_for(label: str) -> str:
    if "北站" in label:
        return "shenzhen-north"
    if "福田" in label:
        return "futian-cbd"
    return "nanshan-tech"


class BatchService:
    def __init__(self, repository: DemoRepository):
        self._prediction_service = PredictionService(repository)

    def create_plan(self, request: BatchRequest) -> dict:
        plan = []
        for index, employee in enumerate(request.employees):
            deadline = datetime.fromisoformat(
                f"{request.date}T{employee.arrival_deadline}:00"
            )
            priority = "cheapest" if index % 3 == 0 else "balanced"
            result = self._prediction_service.predict(
                PredictionRequest(
                    origin_id=ORIGIN_IDS.get(employee.departure, "hku"),
                    destination_id=destination_id_for(employee.destination),
                    target_time=deadline,
                    preferences=PredictionPreferences(priority=priority),
                )
            )
            route = result["ports"][0]
            departure = deadline - timedelta(minutes=route["total_time"] + 10)
            plan.append(
                {
                    "employee_id": employee.id,
                    "recommended_port": route["name"],
                    "departure_time": departure.strftime("%H:%M"),
                    "total_time": route["total_time"],
                    "late_risk_percent": route["late_risk_percent"],
                }
            )

        high_risk_count = sum(item["late_risk_percent"] >= 20 for item in plan)
        return {
            "company": request.company,
            "date": request.date,
            "plan": plan,
            "summary": {
                "employee_count": len(plan),
                "avg_commute_time": round(
                    sum(item["total_time"] for item in plan) / len(plan)
                ),
                "high_risk_count": high_risk_count,
                "recommendation": "高风险员工建议提前20分钟出发，并订阅异常拥堵提醒。",
            },
        }
