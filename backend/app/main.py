from pathlib import Path
import json

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


ROOT_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT_DIR / "data"
OUTPUT_FILE = DATA_DIR / "sample_output.json"

SUPPORTED_TOPICS = {"wastewise", "clinicflow", "hireready"}


class DemoRequest(BaseModel):
    topic: str = Field(default="wastewise")
    scenario: str | None = None
    records: list[dict] = Field(default_factory=list)


app = FastAPI(title="SIUS2612 Topic 2 Demo API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_outputs() -> dict:
    with OUTPUT_FILE.open("r", encoding="utf-8") as file:
        return json.load(file)


def get_topic_state(topic: str) -> dict:
    normalized = topic.lower()
    if normalized not in SUPPORTED_TOPICS:
        raise HTTPException(status_code=404, detail=f"Unsupported topic: {topic}")

    outputs = load_outputs()
    return outputs[normalized]


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "service": "topic2-demo-api"}


@app.get("/api/demo-state")
def demo_state(topic: str = "wastewise") -> dict:
    return get_topic_state(topic)


@app.post("/api/analyze")
def analyze(request: DemoRequest) -> dict:
    state = get_topic_state(request.topic)
    return {
        "topic": state["topic"],
        "scenario": request.scenario or state["scenario"],
        "analysis": state["analysis"],
        "metrics": state["metrics"],
        "table": state["table"],
    }


@app.post("/api/recommendations")
def recommendations(request: DemoRequest) -> dict:
    state = get_topic_state(request.topic)
    return {
        "topic": state["topic"],
        "scenario": request.scenario or state["scenario"],
        "recommendations": state["recommendations"],
    }


@app.post("/api/report")
def report(request: DemoRequest) -> dict:
    state = get_topic_state(request.topic)
    return {
        "topic": state["topic"],
        "scenario": request.scenario or state["scenario"],
        "report": state["report"],
    }

