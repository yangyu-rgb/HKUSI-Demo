export type CrowdLevel = "low" | "medium" | "high";
export type RiskLevel = "low" | "medium" | "high";
export type Priority = "fastest" | "cheapest" | "balanced";

export type ForecastPoint = {
  offset_minutes: number;
  wait: number;
};

export type PortStatus = {
  id: string;
  name: string;
  name_en: string;
  current_wait: number;
  status: "open" | "closed";
  crowd_level: CrowdLevel;
  special_channels: string[];
  passenger_flow: string;
  forecast: ForecastPoint[];
  crowdsource_count: number;
};

export type ServiceAlert = {
  type: string;
  message: string;
  severity: RiskLevel;
};

export type RealtimeResponse = {
  timestamp: string;
  source: string;
  ports: PortStatus[];
  alerts: ServiceAlert[];
};

export type RouteStep = {
  mode: string;
  label: string;
  duration: number;
  cost: number;
};

export type PortPrediction = {
  port_id: string;
  name: string;
  name_en: string;
  predicted_wait_time: number;
  confidence_interval: [number, number];
  risk_level: RiskLevel;
  late_risk_percent: number;
  total_time: number;
  total_cost: number;
  crowdsource_enhanced: boolean;
  crowdsource_count: number;
  route: { steps: RouteStep[] };
  anomalies: string[];
};

export type PredictionResponse = {
  query: {
    departure: string;
    destination: string;
    target_time: string;
    priority: Priority;
  };
  ports: PortPrediction[];
  recommended: string;
  reason: string;
  generated_at: string;
  demo_notice: string;
};

export type CrowdsourceReport = {
  id: string;
  user_id: string;
  port: string;
  actual_wait_time: number;
  crowd_level: CrowdLevel;
  timestamp: string;
  time_label: string;
  comment: string;
};

export type CrowdsourceFeedResponse = {
  reports: CrowdsourceReport[];
  total: number;
};

export type SubscriptionResponse = {
  subscription_id: string;
  next_alert: string;
  message: string;
};

export type BatchPlanResponse = {
  company: string;
  date: string;
  plan: Array<{
    employee_id: number | string;
    recommended_port: string;
    departure_time: string;
    total_time: number;
    late_risk_percent: number;
  }>;
  summary: {
    employee_count: number;
    avg_commute_time: number;
    high_risk_count: number;
    recommendation: string;
  };
};
