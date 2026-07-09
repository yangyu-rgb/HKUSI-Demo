import { request } from "../../shared/api/client";
import type { BatchPlanResponse } from "./types";


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
        { id: "E-104", departure: "九龙塘", destination: "深圳南山", arrival_deadline: "09:45" },
      ],
    }),
  });
}
