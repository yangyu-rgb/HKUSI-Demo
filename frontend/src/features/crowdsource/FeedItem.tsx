import type { CrowdLevel } from "../realtime/types";
import type { CrowdsourceReport } from "./types";
import styles from "./FeedItem.module.css";


const CROWD_LABELS: Record<CrowdLevel, string> = {
  low: "畅通",
  medium: "正常",
  high: "拥挤",
};


export function FeedItem({ report }: { report: CrowdsourceReport }) {
  return (
    <article className={styles.item}>
      <div className={`${styles.avatar} ${styles[report.crowd_level]}`}>
        {report.port.slice(0, 1)}
      </div>
      <div>
        <div className={styles.meta}>
          <strong>{report.port} · {report.actual_wait_time} 分钟</strong>
          <span>{report.time_label}</span>
        </div>
        <p>{report.comment}</p>
        <small>@{report.user_id} · {CROWD_LABELS[report.crowd_level]}</small>
      </div>
    </article>
  );
}
