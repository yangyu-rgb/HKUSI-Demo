import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useDemoContext } from "../demo/useDemo";
import { userFacingError } from "../../shared/api/client";
import { queryKeys } from "../../shared/queryKeys";
import { fetchLocations, fetchPrediction } from "./api";
import type { PredictionQueryInput } from "./types";


export const DEFAULT_QUERY: PredictionQueryInput = {
  origin_id: "hku",
  destination_id: "nanshan-tech",
  target_time: "2026-07-09T09:30",
  priority: "balanced",
  max_budget: 100,
};


export function usePrediction() {
  const [query, setQuery] = useState<PredictionQueryInput>(DEFAULT_QUERY);
  const [submittedQuery, setSubmittedQuery] = useState<PredictionQueryInput>(DEFAULT_QUERY);
  const locations = useQuery({
    queryKey: queryKeys.locations,
    queryFn: fetchLocations,
    staleTime: Infinity,
  });
  const context = useDemoContext();
  const prediction = useQuery({
    queryKey: queryKeys.prediction(submittedQuery),
    queryFn: () => fetchPrediction(submittedQuery),
  });

  async function runPrediction() {
    if (JSON.stringify(query) === JSON.stringify(submittedQuery)) {
      await prediction.refetch();
    } else {
      setSubmittedQuery({ ...query });
    }
  }

  const requestError = locations.error ?? context.error ?? prediction.error;
  return {
    locations: locations.data ?? null,
    context: context.data ?? null,
    prediction: prediction.data ?? null,
    query,
    setQuery,
    loading: locations.isPending || context.isPending || prediction.isPending,
    predicting: prediction.isFetching && !prediction.isPending,
    error: requestError ? userFacingError(requestError) : "",
    runPrediction,
  };
}
