import type { components } from "../../generated/api";
import { request } from "../../shared/api/client";


export type DemoContext = components["schemas"]["DemoContextResponse"];
export type DemoResetResponse = components["schemas"]["DemoResetResponse"];
export type ShadowObservationSummary = components["schemas"]["ShadowObservationSummaryResponse"];
export type V2Readiness = components["schemas"]["V2ReadinessResponse"];


export function fetchDemoContext(): Promise<DemoContext> {
  return request("/api/demo/context");
}


export function fetchModelShadowSummary(): Promise<ShadowObservationSummary> {
  return request("/api/demo/model-shadow-summary");
}


export function fetchV2Readiness(): Promise<V2Readiness> {
  return request("/api/demo/v2-readiness");
}


export function resetDemo(): Promise<DemoResetResponse> {
  return request("/api/demo/reset", { method: "POST" });
}
