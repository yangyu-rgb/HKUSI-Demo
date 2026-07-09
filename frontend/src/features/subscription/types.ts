import type { Priority } from "../prediction/types";


export type SubscriptionInput = {
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
};

export type SubscriptionResponse = {
  subscription_id: string;
  next_alert: string;
  message: string;
};
