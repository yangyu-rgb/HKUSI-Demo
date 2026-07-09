import type { CrowdLevel, PortStatus } from "./types";
import styles from "./PortCard.module.css";


const CROWD_LABELS: Record<CrowdLevel, string> = {
  low: "畅通",
  medium: "正常",
  high: "拥挤",
};


export function PortCard({ port }: { port: PortStatus }) {
  const maxWait = Math.max(...port.forecast.map((point) => point.wait), 1);
  return (
    <article className={styles.card}>
      <div className={styles.top}>
        <div className={styles.title}>
          <span className={`${styles.dot} ${styles[port.crowd_level]}`} />
          <strong>{port.name}</strong>
          <small>{port.name_en}</small>
        </div>
        <span className={`${styles.crowd} ${styles[port.crowd_level]}`}>
          {CROWD_LABELS[port.crowd_level]}
        </span>
      </div>
      <div className={styles.wait}>
        <span>当前等待</span>
        <strong>{port.current_wait}<small>分钟</small></strong>
      </div>
      <div className={styles.forecast} aria-label={`${port.name}未来三小时预测`}>
        {port.forecast.map((point) => (
          <div className={styles.forecastItem} key={point.offset_minutes}>
            <div className={styles.track}>
              <span style={{ height: `${Math.max(24, (point.wait / maxWait) * 100)}%` }} />
            </div>
            <b>{point.wait}</b>
            <small>{point.offset_minutes === 0 ? "现在" : `+${point.offset_minutes / 60}h`}</small>
          </div>
        ))}
      </div>
      <div className={styles.meta}>
        <span>{port.special_channels[0]}</span>
        <span>{port.crowdsource_count} 条现场反馈</span>
      </div>
    </article>
  );
}
