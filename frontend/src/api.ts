import type {
  BatchPlanResponse,
  CrowdLevel,
  CrowdsourceFeedResponse,
  PredictionResponse,
  Priority,
  RealtimeResponse,
  SubscriptionResponse
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    }
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function fetchRealtime(): Promise<RealtimeResponse> {
  return request("/api/realtime");
}

export function fetchPrediction(payload: {
  departure: string;
  destination: string;
  target_time: string;
  preferences: { priority: Priority; max_budget?: number };
}): Promise<PredictionResponse> {
  return request("/api/predict", { method: "POST", body: JSON.stringify(payload) });
}

export function fetchCrowdsourceFeed(): Promise<CrowdsourceFeedResponse> {
  return request("/api/crowdsource/feed");
}

export function submitCrowdsourceReport(payload: {
  user_id: string;
  port: string;
  actual_wait_time: number;
  crowd_level: CrowdLevel;
  comment: string;
}): Promise<{ message: string; points_earned: number; model_updated: boolean }> {
  return request("/api/crowdsource/report", { method: "POST", body: JSON.stringify(payload) });
}

export function createSubscription(payload: {
  user_id: string;
  routine: {
    departure: string;
    destination: string;
    days: string[];
    arrival_deadline: string;
    priority: Priority;
  };
  alerts: {
    advance_reminder: boolean;
    anomaly_alert: boolean;
    better_route_alert: boolean;
  };
}): Promise<SubscriptionResponse> {
  return request("/api/subscription", { method: "POST", body: JSON.stringify(payload) });
}

export function createBatchPlan(): Promise<BatchPlanResponse> {
  return request("/api/batch", {
    method: "POST",
    body: JSON.stringify({
      company: "大湾区跨境服务有限公司",
      date: "2026-07-09",
      employees: [
        { id: "E-101", departure: "香港大学", destination: "深圳南山", arrival_deadline: "09:30" },
        { id: "E-102", departure: "中环", destination: "深圳南山", arrival_deadline: "09:30" },
        { id: "E-103", departure: "香港大学", destination: "深圳福田", arrival_deadline: "10:00" },
        { id: "E-104", departure: "九龙塘", destination: "深圳南山", arrival_deadline: "09:45" }
      ]
    })
  });
}
