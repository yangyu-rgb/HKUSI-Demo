export type CrowdLevel = "low" | "medium" | "high";
export type RiskLevel = "low" | "medium" | "high";

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
