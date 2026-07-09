import { useQuery } from "@tanstack/react-query";
import { userFacingError } from "../../shared/api/client";
import { queryKeys } from "../../shared/queryKeys";
import { fetchRealtime } from "./api";


export function useRealtime() {
  const query = useQuery({
    queryKey: queryKeys.realtime,
    queryFn: fetchRealtime,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  return {
    data: query.data ?? null,
    loading: query.isPending,
    refreshing: query.isFetching && !query.isPending,
    error: query.error ? userFacingError(query.error) : "",
    refresh: async () => {
      await query.refetch();
    },
    dataUpdatedAt: query.dataUpdatedAt,
  };
}
