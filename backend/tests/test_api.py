from fastapi.testclient import TestClient


def test_health_realtime_and_locations(client: TestClient) -> None:
    health = client.get("/api/health")
    realtime = client.get("/api/realtime")
    locations = client.get("/api/locations")

    assert health.status_code == 200
    assert realtime.status_code == 200
    assert locations.status_code == 200
    assert len(realtime.json()["ports"]) == 4
    assert len(locations.json()["origins"]) == 3
    assert len(locations.json()["destinations"]) == 3


def test_prediction_contract(client: TestClient) -> None:
    response = client.post(
        "/api/predict",
        json={
            "origin_id": "hku",
            "destination_id": "nanshan-tech",
            "target_time": "2026-07-09T09:30:00",
            "preferences": {"priority": "balanced", "max_budget": 100},
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["recommended_port_id"] == "futian"
    assert len(payload["ports"]) == 4
    assert {"latest_departure", "estimated_arrival", "buffer_minutes", "on_time"} <= set(
        payload["ports"][0]
    )


def test_invalid_location_returns_422(client: TestClient) -> None:
    response = client.post(
        "/api/predict",
        json={
            "origin_id": "invalid",
            "destination_id": "nanshan-tech",
            "target_time": "2026-07-09T09:30:00",
            "preferences": {"priority": "balanced"},
        },
    )

    assert response.status_code == 422
    assert "Unsupported origin_id" in response.json()["detail"]


def test_crowdsource_subscription_and_batch(client: TestClient) -> None:
    feed = client.get("/api/crowdsource/feed")
    report = client.post(
        "/api/crowdsource/report",
        json={
            "user_id": "test-user",
            "port": "福田",
            "actual_wait_time": 12,
            "crowd_level": "low",
            "comment": "测试反馈",
        },
    )
    subscription = client.post(
        "/api/subscription",
        json={
            "user_id": "test-user",
            "routine": {
                "departure": "香港大学",
                "destination": "深圳南山科技园",
                "days": ["monday"],
                "arrival_deadline": "09:30",
                "priority": "balanced",
            },
            "alerts": {},
        },
    )
    batch = client.post(
        "/api/batch",
        json={
            "company": "测试企业",
            "date": "2026-07-09",
            "employees": [
                {
                    "id": "E-1",
                    "departure": "香港大学",
                    "destination": "深圳南山",
                    "arrival_deadline": "09:30",
                }
            ],
        },
    )

    assert feed.status_code == 200
    assert report.status_code == 200
    assert subscription.status_code == 200
    assert batch.status_code == 200
    assert report.json()["points_earned"] == 10
    assert batch.json()["summary"]["employee_count"] == 1
