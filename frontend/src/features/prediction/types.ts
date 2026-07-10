import type { components } from "../../generated/api";


export type Priority = components["schemas"]["Priority"];
export type RiskLevel = components["schemas"]["RiskLevel"];
export type LocationOption = components["schemas"]["LocationOption"];
export type LocationsResponse = components["schemas"]["LocationsResponse"];
export type RouteStep = components["schemas"]["RouteStep"];
export type PortPrediction = components["schemas"]["PortPrediction"];
export type PredictionResponse = components["schemas"]["PredictionResponse"];
export type DemoContext = components["schemas"]["DemoContextResponse"];
export type TravelDirection = components["schemas"]["TravelDirection"];

export type PredictionQueryInput = {
  origin_id: string;
  destination_id: string;
  target_time: string;
  priority: Priority;
  max_budget: number | null;
  direction: TravelDirection;
};
