# API Contract

The backend exposes a small topic-agnostic API for the demo dashboard.

Base URL for local development:

```text
http://127.0.0.1:8000
```

## GET `/api/health`

Returns service status.

Response:

```json
{
  "status": "ok",
  "service": "topic2-demo-api"
}
```

## GET `/api/demo-state?topic=wastewise`

Returns one complete prebuilt demo state.

Supported topics:

- `wastewise`
- `clinicflow`
- `hireready`

Response shape:

```json
{
  "topic": "wastewise",
  "title": "WasteWise AI",
  "subtitle": "AI food-waste operations dashboard",
  "scenario": "Rainy exam-week lunch",
  "metrics": [],
  "analysis": [],
  "recommendations": [],
  "report": {},
  "table": []
}
```

## POST `/api/analyze`

Runs deterministic mock AI analysis for the selected topic and scenario.

Request:

```json
{
  "topic": "wastewise",
  "scenario": "Rainy exam-week lunch",
  "records": []
}
```

Response:

```json
{
  "topic": "wastewise",
  "scenario": "Rainy exam-week lunch",
  "analysis": [],
  "metrics": [],
  "table": []
}
```

## POST `/api/recommendations`

Returns operational recommendations for the selected topic.

Request:

```json
{
  "topic": "wastewise",
  "scenario": "Rainy exam-week lunch"
}
```

Response:

```json
{
  "topic": "wastewise",
  "recommendations": []
}
```

## POST `/api/report`

Returns a presentation-ready impact report.

Request:

```json
{
  "topic": "wastewise",
  "scenario": "Rainy exam-week lunch"
}
```

Response:

```json
{
  "topic": "wastewise",
  "report": {}
}
```

