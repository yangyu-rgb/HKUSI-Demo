import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchOperationsSummary } from "../features/demo/api";
import { PageSkeleton } from "../shared/components/PageSkeleton";
import { ErrorState } from "../shared/components/PageState";
import { userFacingError } from "../shared/api/client";
import styles from "./OperationsPage.module.css";


function entries(value: Record<string, number>): [string, number][] {
  return Object.entries(value).sort((left, right) => right[1] - left[1]);
}


export function OperationsPage() {
  const [windowHours, setWindowHours] = useState(24);
  const summary = useQuery({
    queryKey: ["operations-summary", windowHours],
    queryFn: () => fetchOperationsSummary(windowHours),
    refetchInterval: 60_000,
  });
  if (summary.isPending) return <PageSkeleton cards={4} />;
  if (!summary.data || summary.error) {
    return <ErrorState title="Unable to load operations analytics" detail={userFacingError(summary.error)} />;
  }
  const data = summary.data;
  const forecast = data.forecast as { total_runs: number; engine_counts: Record<string, number> };
  const crowdsource = data.crowdsource as { used_for_prediction: number; distinct_reporters: number; average_quality_score: number | null; quality_counts: Record<string, number>; linked_feedback_count: number };
  const errors = data.errors as { total: number; by_code: Record<string, number> };
  const audit = data.audit as { total: number; by_path: Record<string, number> };
  const adapters = data.adapters as { database_ready: boolean; providers: Array<{ provider: string; status: string; fallback: boolean }> };
  const commercial = data.commercial as { active_subscriptions: number; demo_mrr_hkd: number; window_checkout_hkd: number; plan_distribution: Record<string, number>; demo_only: boolean };
  const engineCounts = forecast.engine_counts;
  const qualityCounts = crowdsource.quality_counts;
  const errorCounts = errors.by_code;
  const auditPaths = audit.by_path;
  const providerRows = adapters.providers;
  return (
    <main className="page">
      <div className={styles.intro}>
        <div><span className="sectionKicker">B2B operations intelligence</span><h1>Demo Operations Analytics</h1><p>Summarizes forecast runs, crowd-report confidence, errors, and business actions using local classroom data only.</p></div>
        <div className={styles.window} role="group" aria-label="Analytics time window">
          {[24, 168].map((hours) => <button className={windowHours === hours ? styles.active : ""} onClick={() => setWindowHours(hours)} key={hours}>{hours === 24 ? "24 hours" : "7 days"}</button>)}
        </div>
      </div>
      <section className={styles.metrics} aria-label="Core operations metrics">
        <article><span>Forecast runs</span><strong>{forecast.total_runs}</strong><small>Recorded production-path forecasts</small></article>
        <article><span>Valid crowd reports</span><strong>{crowdsource.used_for_prediction}</strong><small>{crowdsource.distinct_reporters} independent reporters</small></article>
        <article><span>Average quality</span><strong>{crowdsource.average_quality_score ?? "—"}</strong><small>Classroom report score</small></article>
        <article className={errors.total > 0 ? styles.warningMetric : ""}><span>Error events</span><strong>{errors.total}</strong><small>Traceable by request ID</small></article>
        <article><span>Commercial subscriptions</span><strong>{commercial.active_subscriptions}</strong><small>Active local Demo accounts</small></article>
        <article><span>Demo MRR</span><strong>HK${commercial.demo_mrr_hkd}</strong><small>Illustrative value · Not real revenue</small></article>
      </section>
      <section className={styles.grid}>
        <article className={styles.panel}><header><h2>Forecast engine distribution</h2><span>{windowHours === 24 ? "Last 24 hours" : "Last 7 days"}</span></header><div className={styles.bars}>{entries(engineCounts).length ? entries(engineCounts).map(([label, count]) => <div key={label}><span>{label === "v2_2_transparent_hybrid" ? "AI v2.2" : "Statistical fallback"}</span><i><b style={{ width: `${Math.max(8, count / Math.max(1, forecast.total_runs) * 100)}%` }} /></i><strong>{count}</strong></div>) : <p className={styles.empty}>Generate a route forecast to see engine distribution.</p>}</div></article>
        <article className={styles.panel}><header><h2>Crowd-report quality</h2><span>{crowdsource.linked_feedback_count} linked forecasts</span></header><div className={styles.quality}>{["high", "medium", "low"].map((level) => <div key={level}><strong>{qualityCounts[level] ?? 0}</strong><span>{level === "high" ? "High confidence" : level === "medium" ? "Medium confidence" : "Low confidence"}</span></div>)}</div></article>
        <article className={styles.panel}><header><h2>Error and recovery signals</h2><span>{errors.total ? "Needs attention" : "Operating normally"}</span></header>{entries(errorCounts).length ? <ul>{entries(errorCounts).map(([code, count]) => <li key={code}><span>{code}</span><strong>{count}</strong></li>)}</ul> : <p className={styles.empty}>No errors were recorded in this window.</p>}</article>
        <article className={styles.panel}><header><h2>Business action distribution</h2><span>{audit.total} write actions</span></header>{entries(auditPaths).length ? <ul>{entries(auditPaths).slice(0, 6).map(([path, count]) => <li key={path}><span>{path}</span><strong>{count}</strong></li>)}</ul> : <p className={styles.empty}>Actions appear after reports, alerts, or enterprise plans are created.</p>}</article>
      </section>
      <section className={styles.adapterPanel}><div><span className="sectionKicker">Adapter health</span><h2>Classroom runtime adapters</h2></div><div className={styles.adapters}><span className={adapters.database_ready ? styles.ok : styles.bad}>SQLite · {adapters.database_ready ? "Ready" : "Error"}</span>{providerRows.map((provider) => <span className={!provider.fallback && provider.status === "available" ? styles.ok : styles.bad} key={provider.provider}>{provider.provider} · {provider.fallback ? "Fallback" : provider.status}</span>)}</div></section>
      <p className={styles.commercialNote}>Subscriptions, MRR, and checkout amounts are local classroom simulation values, not real customers, revenue, or payments.</p>
    </main>
  );
}
