import { request } from "../../shared/api/client";
import type { SubscriptionInput, SubscriptionResponse } from "./types";


export function createSubscription(
  payload: SubscriptionInput,
): Promise<SubscriptionResponse> {
  return request("/api/subscription", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
