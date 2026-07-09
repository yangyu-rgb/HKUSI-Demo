import { useCallback, useEffect, useState } from "react";
import { fetchCrowdsourceFeed, submitCrowdsourceReport } from "./api";
import type { CrowdsourceReport, ReportInput } from "./types";


export function useCrowdsource() {
  const [reports, setReports] = useState<CrowdsourceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    try {
      const result = await fetchCrowdsourceFeed();
      setReports(result.reports);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "无法载入现场反馈");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submit = useCallback(async (input: ReportInput) => {
    setSubmitting(true);
    setError("");
    setMessage("");
    try {
      const result = await submitCrowdsourceReport(input);
      await refresh();
      setMessage(`+${result.points_earned} 积分 · ${result.message}`);
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "反馈提交失败");
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [refresh]);

  return { reports, loading, submitting, error, message, submit };
}
