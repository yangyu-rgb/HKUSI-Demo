import { formatClock } from "../../shared/formatters";
import type { PortPrediction, RiskLevel } from "./types";
import styles from "./RouteCard.module.css";


const RISK_LABELS: Record<RiskLevel, string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
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
          {recommended && <span className={styles.badge}>AI 推荐</span>}
          <h3>{route.name}口岸</h3>
          <p>{route.name_en}</p>
        </div>
        <span className={`${styles.risk} ${styles[route.risk_level]}`}>
          {RISK_LABELS[route.risk_level]}
        </span>
      </div>

      <div className={`${styles.feasibility} ${route.on_time ? styles.onTime : styles.late}`}>
        <strong>{route.on_time ? `最晚 ${formatClock(route.latest_departure)} 出发` : "预计无法准时到达"}</strong>
        <span>
          {route.on_time
            ? `预计 ${formatClock(route.estimated_arrival)} 到达 · 缓冲 ${route.buffer_minutes} 分钟`
            : `预计迟到 ${Math.abs(route.buffer_minutes)} 分钟`}
        </span>
      </div>

      <div className={styles.metrics}>
        <div><span>全程</span><strong>{route.total_time} 分钟</strong></div>
        <div><span>预计费用</span><strong>HK${route.total_cost}</strong></div>
        <div><span>口岸等待</span><strong>{route.predicted_wait_time} 分钟</strong></div>
        <div><span>迟到风险</span><strong>{route.late_risk_percent}%</strong></div>
      </div>

      {!route.within_budget && <p className={styles.budgetAlert}>超出当前预算上限</p>}
      <div className={styles.confidence}>
        90%预测区间 {route.confidence_interval[0]}–{route.confidence_interval[1]} 分钟
        {route.crowdsource_enhanced && ` · 已融合 ${route.crowdsource_count} 条众包数据`}
      </div>
      <div className={styles.confidence}>
        官方数据 {official.status ?? "missing"} · 客流压力 {official.traffic?.pressure?.toFixed(2) ?? "—"}
        {official.queue?.effective_weight
          ? ` · 15分钟等级权重 ${Math.round(official.queue.effective_weight * 100)}%`
          : " · 当前等级未参与"}
        {official.traffic?.distribution?.status && official.traffic.distribution.status !== "in_distribution"
          ? ` · 分布提示 ${official.traffic.distribution.status}`
          : ""}
      </div>
      <button
        className={styles.calculationButton}
        type="button"
        onClick={(event) => onShowCalculation(event.currentTarget)}
      >
        查看完整计算过程
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg>
      </button>
      <div className={styles.steps}>
        {route.route.steps.map((step, index) => (
          <div className={styles.step} key={`${step.mode}-${step.label}`}>
            <span>{index + 1}</span>
            <div><strong>{step.label}</strong><small>{step.duration} 分钟 · HK${step.cost}</small></div>
          </div>
        ))}
      </div>
      {route.anomalies.length > 0 && <p className={styles.routeAlert}>注意：{route.anomalies[0]}</p>}
    </article>
  );
}
