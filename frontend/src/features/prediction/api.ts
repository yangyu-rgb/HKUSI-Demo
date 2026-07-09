import { request } from "../../shared/api/client";
import type {
  LocationsResponse,
  PredictionQueryInput,
  PredictionResponse,
} from "./types";


export function fetchLocations(): Promise<LocationsResponse> {
  return request("/api/locations");
}


export function fetchPrediction(
  query: PredictionQueryInput,
): Promise<PredictionResponse> {
  return request("/api/predict", {
    method: "POST",
    body: JSON.stringify({
      origin_id: query.origin_id,
      destination_id: query.destination_id,
      target_time: query.target_time,
      preferences: {
        priority: query.priority,
        max_budget: query.max_budget,
      },
    }),
  });
}
