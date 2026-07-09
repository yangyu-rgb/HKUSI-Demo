from datetime import datetime, timedelta
from pathlib import Path
import json

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT_DIR / "data"
PORTS_FILE = DATA_DIR / "realtime" / "ports_status.json"
REPORTS_FILE = DATA_DIR / "crowdsource" / "user_reports.json"


class PredictionPreferences(BaseModel):
    priority: str = Field(default="balanced", pattern="^(fastest|cheapest|balanced)$")
    max_budget: int | None = Field(default=None, ge=0)


class PredictionRequest(BaseModel):
    departure: str = Field(min_length=1)
    destination: str = Field(min_length=1)
    target_time: datetime
    preferences: PredictionPreferences = Field(default_factory=PredictionPreferences)


class CrowdsourceReport(BaseModel):
    user_id: str = Field(default="demo-user", min_length=1)
    port: str = Field(min_length=1)
    actual_wait_time: int = Field(ge=0, le=180)
    crowd_level: str = Field(pattern="^(low|medium|high)$")
    comment: str = Field(default="", max_length=160)


class Routine(BaseModel):
    departure: str = Field(min_length=1)
    destination: str = Field(min_length=1)
    days: list[str] = Field(min_length=1)
    arrival_deadline: str = Field(pattern=r"^\d{2}:\d{2}$")
    priority: str = Field(default="balanced", pattern="^(fastest|cheapest|balanced)$")


class AlertPreferences(BaseModel):
    advance_reminder: bool = True
    anomaly_alert: bool = True
    better_route_alert: bool = True


class SubscriptionRequest(BaseModel):
    user_id: str = Field(default="demo-user", min_length=1)
    routine: Routine
    alerts: AlertPreferences = Field(default_factory=AlertPreferences)


class BatchEmployee(BaseModel):
    id: int | str
    departure: str = Field(min_length=1)
    destination: str = "深圳南山"
    arrival_deadline: str = Field(pattern=r"^\d{2}:\d{2}$")


class BatchRequest(BaseModel):
    company: str = Field(min_length=1)
    employees: list[BatchEmployee] = Field(min_length=1, max_length=100)
    date: str


app = FastAPI(title="CrossBorder AI Demo API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_json(path: Path) -> dict | list:
    with path.open("r", encoding="utf-8") as file:
        return json.load(file)


PORT_STATE = load_json(PORTS_FILE)
REPORTS = list(load_json(REPORTS_FILE))
SUBSCRIPTIONS: list[dict] = []


def find_port(name: str) -> dict:
    normalized = name.strip().lower()
    for port in PORT_STATE["ports"]:
        if normalized in {port["id"], port["name"].lower(), port["name_en"].lower()}:
            return port
    raise HTTPException(status_code=404, detail=f"Unsupported port: {name}")


def projected_wait(port: dict, target_time: datetime) -> int:
    scenario_time = datetime.fromisoformat(PORT_STATE["timestamp"])
    if target_time.tzinfo is not None and scenario_time.tzinfo is None:
        target_time = target_time.replace(tzinfo=None)
    horizon = max(0, int((target_time - scenario_time).total_seconds() / 60))
    point = min(port["forecast"], key=lambda item: abs(item["offset_minutes"] - horizon))
    wait = float(point["wait"])

    port_reports = [report for report in REPORTS if report["port"] == port["name"]][-3:]
    if port_reports:
        reported_average = sum(report["actual_wait_time"] for report in port_reports) / len(port_reports)
        wait = wait * 0.7 + reported_average * 0.3
    return max(1, round(wait))


def risk_for(wait: int, upper: int) -> tuple[str, int]:
    late_risk = min(45, max(5, round(wait * 0.55 + (upper - wait) * 1.8)))
    if late_risk >= 25:
        return "high", late_risk
    if late_risk >= 15:
        return "medium", late_risk
    return "low", late_risk


def prediction_for_port(port: dict, target_time: datetime) -> dict:
    wait = projected_wait(port, target_time)
    lower = max(1, round(wait * 0.78))
    upper = round(wait * 1.25)
    total_time = port["access"]["duration"] + wait + port["onward"]["duration"]
    total_cost = port["access"]["cost"] + port["onward"]["cost"]
    risk_level, late_risk = risk_for(wait, upper)
    recent_count = sum(1 for report in REPORTS if report["port"] == port["name"])

    return {
        "port_id": port["id"],
        "name": port["name"],
        "name_en": port["name_en"],
        "predicted_wait_time": wait,
        "confidence_interval": [lower, upper],
        "risk_level": risk_level,
        "late_risk_percent": late_risk,
        "total_time": total_time,
        "total_cost": total_cost,
        "crowdsource_enhanced": recent_count > 0,
        "crowdsource_count": recent_count,
        "route": {
            "steps": [
                {
                    "mode": port["access"]["mode"],
                    "label": port["access"]["label"],
                    "duration": port["access"]["duration"],
                    "cost": port["access"]["cost"],
                },
                {
                    "mode": "border",
                    "label": f"{port['name']}口岸通关",
                    "duration": wait,
                    "cost": 0,
                },
                {
                    "mode": port["onward"]["mode"],
                    "label": port["onward"]["label"],
                    "duration": port["onward"]["duration"],
                    "cost": port["onward"]["cost"],
                },
            ]
        },
        "anomalies": port.get("anomalies", []),
    }


def choose_recommended(predictions: list[dict], preferences: PredictionPreferences) -> dict:
    eligible = [
        item
        for item in predictions
        if preferences.max_budget is None or item["total_cost"] <= preferences.max_budget
    ]
    if not eligible:
        eligible = predictions

    if preferences.priority == "fastest":
        return min(eligible, key=lambda item: (item["total_time"], item["late_risk_percent"]))
    if preferences.priority == "cheapest":
        return min(eligible, key=lambda item: (item["total_cost"], item["total_time"]))
    return min(
        eligible,
        key=lambda item: item["total_time"] + item["late_risk_percent"] * 1.5 + item["total_cost"] * 0.12,
    )


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "service": "crossborder-ai-api", "mode": "deterministic-demo"}


@app.get("/api/realtime")
def realtime() -> dict:
    return {
        **PORT_STATE,
        "ports": [
            {
                **port,
                "crowdsource_count": sum(1 for report in REPORTS if report["port"] == port["name"]),
            }
            for port in PORT_STATE["ports"]
        ],
    }


@app.post("/api/predict")
def predict(request: PredictionRequest) -> dict:
    predictions = [prediction_for_port(port, request.target_time) for port in PORT_STATE["ports"]]
    recommended = choose_recommended(predictions, request.preferences)
    ordered = sorted(predictions, key=lambda item: (item["name"] != recommended["name"], item["total_time"]))
    return {
        "query": {
            "departure": request.departure,
            "destination": request.destination,
            "target_time": request.target_time.isoformat(),
            "priority": request.preferences.priority,
        },
        "ports": ordered,
        "recommended": recommended["name"],
        "reason": (
            f"{recommended['name']}在当前偏好下综合最优：预计全程"
            f"{recommended['total_time']}分钟，口岸等待{recommended['predicted_wait_time']}分钟，"
            f"迟到风险{recommended['late_risk_percent']}%。"
        ),
        "generated_at": PORT_STATE["timestamp"],
        "demo_notice": "结果由本地确定性规则与众包样本生成，不代表真实口岸状态。",
    }


@app.get("/api/crowdsource/feed")
def crowdsource_feed(limit: int = 8) -> dict:
    safe_limit = min(max(limit, 1), 30)
    return {"reports": list(reversed(REPORTS[-safe_limit:])), "total": len(REPORTS)}


@app.post("/api/crowdsource/report")
def submit_crowdsource_report(report: CrowdsourceReport) -> dict:
    port = find_port(report.port)
    model_updated = abs(report.actual_wait_time - port["current_wait"]) > 5
    record = {
        "id": f"report-{len(REPORTS) + 1:03d}",
        "user_id": report.user_id,
        "port": port["name"],
        "actual_wait_time": report.actual_wait_time,
        "crowd_level": report.crowd_level,
        "timestamp": PORT_STATE["timestamp"],
        "time_label": "刚刚",
        "comment": report.comment or "现场通关反馈",
    }
    REPORTS.append(record)
    return {
        "success": True,
        "points_earned": 10,
        "model_updated": model_updated,
        "report": record,
        "message": "感谢反馈！你的数据已加入本次演示的预测校准。",
    }


@app.post("/api/subscription")
def create_subscription(request: SubscriptionRequest) -> dict:
    subscription_id = f"sub-{len(SUBSCRIPTIONS) + 1:03d}"
    deadline = datetime.strptime(request.routine.arrival_deadline, "%H:%M")
    next_alert = deadline - timedelta(minutes=75)
    subscription = {
        "subscription_id": subscription_id,
        "user_id": request.user_id,
        "routine": request.routine.model_dump(),
        "alerts": request.alerts.model_dump(),
    }
    SUBSCRIPTIONS.append(subscription)
    return {
        **subscription,
        "next_alert": next_alert.strftime("%H:%M"),
        "message": f"订阅已设置，将在预计出发前30分钟（约{next_alert.strftime('%H:%M')}）提醒。",
    }


@app.post("/api/batch")
def create_batch_plan(request: BatchRequest) -> dict:
    base_predictions = [
        prediction_for_port(port, datetime.fromisoformat(f"{request.date}T09:00:00"))
        for port in PORT_STATE["ports"]
    ]
    balanced = choose_recommended(base_predictions, PredictionPreferences())
    cheapest = choose_recommended(base_predictions, PredictionPreferences(priority="cheapest"))
    plan = []
    for index, employee in enumerate(request.employees):
        route = balanced if index % 3 else cheapest
        deadline = datetime.fromisoformat(f"{request.date}T{employee.arrival_deadline}:00")
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
            "avg_commute_time": round(sum(item["total_time"] for item in plan) / len(plan)),
            "high_risk_count": high_risk_count,
            "recommendation": "高风险员工建议提前20分钟出发，并订阅异常拥堵提醒。",
        },
    }
