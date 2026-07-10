import { request } from "../../shared/api/client";
import type {
  SubscriptionInput,
  SubscriptionEvaluation,
  SubscriptionEvaluationListResponse,
  SubscriptionEvaluationRecord,
  SubscriptionListResponse,
  SubscriptionRecord,
  SubscriptionUpdate,
  AlertCycleResponse,
  NotificationListResponse,
  NotificationRecord,
} from "./types";


export function fetchSubscriptions(userId: string): Promise<SubscriptionListResponse> {
  return request(`/api/subscriptions?user_id=${encodeURIComponent(userId)}`);
}


export function createSubscription(
  payload: SubscriptionInput,
): Promise<SubscriptionRecord> {
  return request("/api/subscriptions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}


export function fetchSubscriptionPreview(
  subscriptionId: string,
): Promise<SubscriptionEvaluation> {
  return request(`/api/subscriptions/${subscriptionId}/preview`);
}


export function saveSubscriptionEvaluation(
  subscriptionId: string,
): Promise<SubscriptionEvaluationRecord> {
  return request(`/api/subscriptions/${subscriptionId}/evaluations`, {
    method: "POST",
  });
}


export function fetchSubscriptionEvaluations(
  subscriptionId: string,
): Promise<SubscriptionEvaluationListResponse> {
  return request(`/api/subscriptions/${subscriptionId}/evaluations`);
}


export function markSubscriptionEvaluationRead(
  evaluationId: string,
): Promise<SubscriptionEvaluationRecord> {
  return request(`/api/subscription-evaluations/${evaluationId}/read`, {
    method: "PATCH",
  });
}


export function updateSubscription(
  subscriptionId: string,
  payload: SubscriptionUpdate,
): Promise<SubscriptionRecord> {
  return request(`/api/subscriptions/${subscriptionId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}


export function deleteSubscription(subscriptionId: string): Promise<void> {
  return request(`/api/subscriptions/${subscriptionId}`, { method: "DELETE" });
}


export function runAlertCycle(userId: string): Promise<AlertCycleResponse> {
  return request(`/api/demo/alerts/run-cycle?user_id=${encodeURIComponent(userId)}`, {
    method: "POST",
  });
}


export function fetchNotifications(userId: string): Promise<NotificationListResponse> {
  return request(`/api/notifications?user_id=${encodeURIComponent(userId)}`);
}


export function markNotificationRead(notificationId: string): Promise<NotificationRecord> {
  return request(`/api/notifications/${notificationId}/read`, { method: "PATCH" });
}
