import { request } from "../../shared/api/client";
import type {
  BatchHistoryResponse,
  BatchPlanResponse,
  BatchRequest,
} from "./types";


export function createBatchPlan(payload: BatchRequest): Promise<BatchPlanResponse> {
  return request("/api/batch", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}


export function fetchBatchPlans(company: string): Promise<BatchHistoryResponse> {
  return request(`/api/batch/plans?company=${encodeURIComponent(company)}&limit=10`);
}
