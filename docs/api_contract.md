# CrossBorder AI API Contract

The local FastAPI backend exposes deterministic CrossBorder AI demo endpoints.

Base URL:

```text
http://127.0.0.1:8000
```

## GET `/api/health`

Returns service and demo-mode status.

```json
{
  "status": "ok",
  "service": "crossborder-ai-api",
  "mode": "deterministic-demo"
}
```

## GET `/api/realtime`

Returns the scenario timestamp, service alerts, and current status for 罗湖、福田、皇岗、深圳湾.

Each port includes:

- Current wait and crowd level
- Open status and special channels
- Zero-, one-, and two-hour forecast points
- Access and onward transport assumptions
- Number of crowdsource samples

## POST `/api/predict`

Compares all four ports for one cross-border trip.

Request:

```json
{
  "departure": "香港大学",
  "destination": "深圳南山科技园",
  "target_time": "2026-07-09T09:30:00",
  "preferences": {
    "priority": "balanced",
    "max_budget": 100
  }
}
```

Valid priorities are `balanced`, `fastest`, and `cheapest`.

Response:

```json
{
  "query": {
    "departure": "香港大学",
    "destination": "深圳南山科技园",
    "target_time": "2026-07-09T09:30:00",
    "priority": "balanced"
  },
  "ports": [
    {
      "port_id": "futian",
      "name": "福田",
      "predicted_wait_time": 16,
      "confidence_interval": [12, 20],
      "risk_level": "low",
      "late_risk_percent": 13,
      "total_time": 82,
      "total_cost": 49,
      "crowdsource_enhanced": true,
      "route": {
        "steps": []
      }
    }
  ],
  "recommended": "福田",
  "reason": "福田在当前偏好下综合最优。",
  "demo_notice": "结果由本地确定性规则与众包样本生成，不代表真实口岸状态。"
}
```

The demo predictor blends the closest time-horizon forecast with recent crowdsource waits at a 70/30 weighting. Confidence and late-risk values are deterministic heuristics.

## GET `/api/crowdsource/feed`

Query parameter:

- `limit`: 1–30, default 8

Response:

```json
{
  "reports": [],
  "total": 4
}
```

## POST `/api/crowdsource/report`

Adds one in-memory report. A difference greater than five minutes from the current port wait marks `model_updated` as true.

Request:

```json
{
  "user_id": "demo-user",
  "port": "福田",
  "actual_wait_time": 12,
  "crowd_level": "low",
  "comment": "排队很短，通关顺畅。"
}
```

Response:

```json
{
  "success": true,
  "points_earned": 10,
  "model_updated": false,
  "report": {},
  "message": "感谢反馈！你的数据已加入本次演示的预测校准。"
}
```

## POST `/api/subscription`

Creates an in-memory smart-alert configuration.

Request:

```json
{
  "user_id": "demo-user",
  "routine": {
    "departure": "香港大学",
    "destination": "深圳南山科技园",
    "days": ["monday", "wednesday", "friday"],
    "arrival_deadline": "09:30",
    "priority": "balanced"
  },
  "alerts": {
    "advance_reminder": true,
    "anomaly_alert": true,
    "better_route_alert": true
  }
}
```

## POST `/api/batch`

Generates a deterministic employee dispatch plan for the B2B demo.

Request:

```json
{
  "company": "大湾区跨境服务有限公司",
  "date": "2026-07-09",
  "employees": [
    {
      "id": "E-101",
      "departure": "香港大学",
      "destination": "深圳南山",
      "arrival_deadline": "09:30"
    }
  ]
}
```

The response contains one recommended port and departure time per employee plus summary risk metrics.

## Demo Boundaries

- No live i口岸, transport, weather, notification, or map integrations.
- No production machine-learning model.
- Submitted reports and subscriptions reset on backend restart.
- API outputs are decision-support examples, not operational border guidance.
