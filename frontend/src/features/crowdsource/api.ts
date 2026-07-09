import { request } from "../../shared/api/client";
import type {
  CrowdsourceFeedResponse,
  ReportInput,
} from "./types";


export function fetchCrowdsourceFeed(): Promise<CrowdsourceFeedResponse> {
  return request("/api/crowdsource/feed");
}


export function submitCrowdsourceReport(
  payload: ReportInput,
): Promise<{ message: string; points_earned: number; model_updated: boolean }> {
  return request("/api/crowdsource/report", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
