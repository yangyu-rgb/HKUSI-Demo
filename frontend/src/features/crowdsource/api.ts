import { request } from "../../shared/api/client";
import type {
  CrowdsourceFeedResponse,
  CrowdsourceSubmitResponse,
  ReportInput,
} from "./types";


export function fetchCrowdsourceFeed(): Promise<CrowdsourceFeedResponse> {
  return request("/api/crowdsource/feed");
}


export function submitCrowdsourceReport(
  payload: ReportInput,
): Promise<CrowdsourceSubmitResponse> {
  return request("/api/crowdsource/report", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
