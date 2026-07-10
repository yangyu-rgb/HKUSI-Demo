import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../shared/queryKeys";
import {
  fetchDemoContext,
  fetchModelShadowSummary,
  fetchV2Readiness,
  resetDemo,
} from "./api";


export function useDemoContext() {
  return useQuery({
    queryKey: queryKeys.demoContext,
    queryFn: fetchDemoContext,
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}


export function useModelShadowSummary() {
  return useQuery({
    queryKey: queryKeys.modelShadowSummary,
    queryFn: fetchModelShadowSummary,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}


export function useV2Readiness() {
  return useQuery({
    queryKey: queryKeys.v2Readiness,
    queryFn: fetchV2Readiness,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}


export function useDemoReset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resetDemo,
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    },
  });
}
