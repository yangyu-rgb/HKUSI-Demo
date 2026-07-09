import { useCallback, useEffect, useState } from "react";
import { fetchRealtime } from "./api";
import type { RealtimeResponse } from "./types";


export function useRealtime() {
  const [data, setData] = useState<RealtimeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchRealtime());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "无法载入口岸状态");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
