import { request } from "../../shared/api/client";
import type { RealtimeResponse } from "./types";


export function fetchRealtime(): Promise<RealtimeResponse> {
  return request("/api/realtime");
}
