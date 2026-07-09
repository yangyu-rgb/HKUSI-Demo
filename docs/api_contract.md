# CrossBorder AI API Contract

Base URL:

```text
http://127.0.0.1:8000
```

The API uses deterministic local data. Domain validation errors return HTTP `422` with a JSON `detail` field.

## GET `/api/health`

Returns service and demo-mode status.

## GET `/api/realtime`

Returns the scenario timestamp, service alerts, and current status for 罗湖、福田、皇岗、深圳湾.

Each port includes its current wait, crowd level, open state, special channels, forecast points, and crowdsource sample count.

## GET `/api/locations`

Returns the locations supported by the deterministic transit matrix.

```json
{
  "origins": [
    {"id": "hku", "name": "香港大学", "city": "香港"},
    {"id": "central", "name": "中环", "city": "香港"},
    {"id": "kowloon-tong", "name": "九龙塘", "city": "香港"}
  ],
  "destinations": [
    {"id": "nanshan-tech", "name": "深圳南山科技园", "city": "深圳"},
    {"id": "futian-cbd", "name": "深圳福田 CBD", "city": "深圳"},
    {"id": "shenzhen-north", "name": "深圳北站", "city": "深圳"}
  ]
}
```

## POST `/api/predict`

Compares all four ports for one supported origin/destination pair.

Request:

```json
{
  "origin_id": "hku",
  "destination_id": "nanshan-tech",
  "target_time": "2026-07-09T09:30:00",
  "preferences": {
    "priority": "balanced",
    "max_budget": 100
  }
}
```

Valid priorities are `balanced`, `fastest`, and `cheapest`. Set `max_budget` to `null` to disable budget filtering.

Each port result includes:

- Predicted border wait and confidence interval
- End-to-end time and cost from the location matrix
- Estimated arrival if leaving at the scenario time
- Latest departure including a ten-minute safety buffer
- Positive or negative arrival buffer
- `on_time` and `within_budget` decision flags
- Route steps, crowdsource sample count, risk, and anomalies

Response excerpt:

```json
{
  "query": {
    "origin_id": "hku",
    "origin_name": "香港大学",
    "destination_id": "nanshan-tech",
    "destination_name": "深圳南山科技园",
    "target_time": "2026-07-09T09:30:00",
    "priority": "balanced",
    "max_budget": 100
  },
  "ports": [
    {
      "port_id": "futian",
      "name": "福田",
      "total_time": 84,
      "total_cost": 49,
      "estimated_arrival": "2026-07-09T09:09:00",
      "latest_departure": "2026-07-09T07:56:00",
      "buffer_minutes": 21,
      "on_time": true,
      "within_budget": true
    }
  ],
  "recommended": "福田",
  "recommended_port_id": "futian",
  "warnings": []
}
```

Recommendation behavior:

1. Prefer routes that are both on time and within budget.
2. Apply the selected fastest, cheapest, or balanced scoring within that set.
3. If all budget-eligible routes are late, recommend the least-late route.
4. If all routes exceed budget, recommend the lowest-cost route and return a warning.

The predictor blends the nearest forecast horizon with the last three crowdsource waits for that port at a 70/30 weighting.

## GET `/api/crowdsource/feed`

Returns the most recent in-memory reports. `limit` accepts values from 1 to 30.

## POST `/api/crowdsource/report`

Adds an in-memory report and awards ten demo points. A wait difference greater than five minutes marks `model_updated` as true.

## POST `/api/subscription`

Creates an in-memory smart-alert configuration and returns the next demo alert time.

## POST `/api/batch`

Generates deterministic port and departure recommendations for up to 100 employees.

## Demo Boundaries

- No live border, map, transport, weather, notification, or AI services.
- No production machine-learning model or persistent database.
- Submitted reports and subscriptions reset on backend restart.
- Outputs are decision-support examples, not operational border guidance.
