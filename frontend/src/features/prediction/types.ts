export type Priority = "fastest" | "cheapest" | "balanced";
export type RiskLevel = "low" | "medium" | "high";

export type LocationOption = {
  id: string;
  name: string;
  city: string;
};

export type LocationsResponse = {
  origins: LocationOption[];
  destinations: LocationOption[];
};

export type PredictionQueryInput = {
  origin_id: string;
  destination_id: string;
  target_time: string;
  priority: Priority;
  max_budget: number | null;
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
  estimated_arrival: string;
  latest_departure: string;
  buffer_minutes: number;
  on_time: boolean;
  within_budget: boolean;
  crowdsource_enhanced: boolean;
  crowdsource_count: number;
  route: { steps: RouteStep[] };
  anomalies: string[];
};

export type PredictionResponse = {
  query: {
    origin_id: string;
    origin_name: string;
    destination_id: string;
    destination_name: string;
    target_time: string;
    priority: Priority;
    max_budget: number | null;
  };
  ports: PortPrediction[];
  recommended: string;
  recommended_port_id: string;
  reason: string;
  warnings: string[];
  generated_at: string;
  demo_notice: string;
};
