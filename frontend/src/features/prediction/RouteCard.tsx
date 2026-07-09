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
}: {
  route: PortPrediction;
  recommended: boolean;
}) {
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
        预测区间 {route.confidence_interval[0]}–{route.confidence_interval[1]} 分钟
        {route.crowdsource_enhanced && ` · 已融合 ${route.crowdsource_count} 条众包数据`}
      </div>
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
