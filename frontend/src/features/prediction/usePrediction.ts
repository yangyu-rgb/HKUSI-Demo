import { useCallback, useEffect, useState } from "react";
import { fetchLocations, fetchPrediction } from "./api";
import type {
  LocationsResponse,
  PredictionQueryInput,
  PredictionResponse,
} from "./types";


export const DEFAULT_QUERY: PredictionQueryInput = {
  origin_id: "hku",
  destination_id: "nanshan-tech",
  target_time: "2026-07-09T09:30",
  priority: "balanced",
  max_budget: 100,
};


export function usePrediction() {
  const [locations, setLocations] = useState<LocationsResponse | null>(null);
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [query, setQuery] = useState<PredictionQueryInput>(DEFAULT_QUERY);
  const [loading, setLoading] = useState(true);
  const [predicting, setPredicting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([fetchLocations(), fetchPrediction(DEFAULT_QUERY)])
      .then(([locationData, predictionData]) => {
        setLocations(locationData);
        setPrediction(predictionData);
      })
      .catch((requestError) => {
        setError(requestError instanceof Error ? requestError.message : "无法载入路线预测");
      })
      .finally(() => setLoading(false));
  }, []);

  const runPrediction = useCallback(async () => {
    setPredicting(true);
    setError("");
    try {
      setPrediction(await fetchPrediction(query));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "路线预测失败");
    } finally {
      setPredicting(false);
    }
  }, [query]);

  return {
    locations,
    prediction,
    query,
    setQuery,
    loading,
    predicting,
    error,
    runPrediction,
  };
}
