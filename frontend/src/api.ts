import type { DemoState, TopicId } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000";

export async function fetchDemoState(topic: TopicId): Promise<DemoState> {
  const response = await fetch(`${API_BASE}/api/demo-state?topic=${topic}`);
  if (!response.ok) {
    throw new Error(`Failed to load demo state: ${response.status}`);
  }

  return response.json();
}

