import type { CrowdLevel } from "../realtime/types";
import type { CrowdsourceReport } from "./types";
import { formatClock } from "../../shared/formatters";
import styles from "./FeedItem.module.css";


const CROWD_LABELS: Record<CrowdLevel, string> = {
  low: "畅通",
  medium: "正常",
  high: "拥挤",
};

const QUALITY_LABELS = {
  high: "高可信",
  medium: "中可信",
  low: "低可信",
} as const;


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
        <div className={styles.details}>
          <small>@{report.user_id} · {CROWD_LABELS[report.crowd_level]}</small>
          <span className={`${styles.quality} ${styles[report.quality_level]}`}>
            {QUALITY_LABELS[report.quality_level]} {report.quality_score}分
          </span>
          <small>
            有效至 {formatClock(report.expires_at)}
            {!report.used_for_prediction && " · 不参与预测"}
          </small>
          <small>课堂演示反馈 · 不进入训练数据</small>
        </div>
      </div>
    </article>
  );
}
