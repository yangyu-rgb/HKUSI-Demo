import { formatClock } from "../../shared/formatters";
import type { PortPrediction, RiskLevel } from "./types";
import styles from "./RouteCard.module.css";


const RISK_LABELS: Record<RiskLevel, string> = {
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk",
};


export function RouteCard({
  route,
  recommended,
  onShowCalculation,
}: {
  route: PortPrediction;
  recommended: boolean;
  onShowCalculation: (trigger: HTMLButtonElement) => void;
}) {
  const official = (route.official_calibration ?? {}) as {
    status?: string;
    traffic?: { pressure?: number; expected_count?: number; baseline_count?: number; distribution?: { status?: string } };
    queue?: { resident_level?: string | null; visitor_level?: string | null; effective_weight?: number; age_minutes?: number };
    shenzhen_validation?: { available?: boolean; agreement_percent?: number | null; uncertainty_multiplier?: number; reason?: string };
    raw_model_wait_minutes?: number;
    scenario_adjusted_wait_minutes?: number;
    queue_adjusted_wait_minutes?: number;
    crowdsource_adjustment_minutes?: number;
    uncertainty_minutes?: number;
  };
  return (
    <article className={`${styles.card} ${recommended ? styles.recommended : ""}`}>
      <div className={styles.header}>
        <div>
          {recommended && <span className={styles.badge}>AI recommended</span>}
          <h3>{route.name_en} Port</h3>
        </div>
        <span className={`${styles.risk} ${styles[route.risk_level]}`}>
          {RISK_LABELS[route.risk_level]}
        </span>
      </div>

      <div className={`${styles.feasibility} ${route.on_time ? styles.onTime : styles.late}`}>
        <strong>{route.on_time ? `Depart by ${formatClock(route.latest_departure)}` : "On-time arrival is unlikely"}</strong>
        <span>
          {route.on_time
            ? `Estimated arrival ${formatClock(route.estimated_arrival)} · ${route.buffer_minutes}-minute buffer`
            : `Estimated ${Math.abs(route.buffer_minutes)} minutes late`}
        </span>
      </div>

      <div className={styles.metrics}>
        <div><span>Total trip</span><strong>{route.total_time} min</strong></div>
        <div><span>Estimated cost</span><strong>HK${route.total_cost}</strong></div>
        <div><span>Border wait</span><strong>{route.predicted_wait_time} min</strong></div>
        <div><span>Late risk</span><strong>{route.late_risk_percent}%</strong></div>
      </div>

      {!route.within_budget && <p className={styles.budgetAlert}>Above the current budget cap</p>}
      <div className={styles.confidence}>
        90% forecast interval: {route.confidence_interval[0]}–{route.confidence_interval[1]} minutes
        {route.crowdsource_enhanced && ` · Includes ${route.crowdsource_count} crowd reports`}
      </div>
      <div className={styles.confidence}>
        Official data: {official.status ?? "missing"} · Passenger pressure: {official.traffic?.pressure?.toFixed(2) ?? "—"}
        {official.queue?.effective_weight
          ? ` · 15-minute status weight ${Math.round(official.queue.effective_weight * 100)}%`
          : " · Current status not applied"}
        {official.traffic?.distribution?.status && official.traffic.distribution.status !== "in_distribution"
          ? ` · Distribution note: ${official.traffic.distribution.status}`
          : ""}
      </div>
      <button
        className={styles.calculationButton}
        type="button"
        onClick={(event) => onShowCalculation(event.currentTarget)}
      >
        View full calculation
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg>
      </button>
      <div className={styles.steps}>
        {route.route.steps.map((step, index) => (
          <div className={styles.step} key={`${step.mode}-${step.label}`}>
            <span>{index + 1}</span>
            <div><strong>{step.label}</strong><small>{step.duration} min · HK${step.cost}</small></div>
          </div>
        ))}
      </div>
      {route.anomalies.length > 0 && <p className={styles.routeAlert}>Note: {route.anomalies[0]}</p>}
    </article>
  );
}
