import type { CrowdLevel } from "../realtime/types";
import type { CrowdsourceReport } from "./types";
import { formatClock } from "../../shared/formatters";
import { englishDisplayText } from "../../shared/displayText";
import styles from "./FeedItem.module.css";


const CROWD_LABELS: Record<CrowdLevel, string> = {
  low: "Clear",
  medium: "Moderate",
  high: "Crowded",
};

const QUALITY_LABELS = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence",
} as const;


export function FeedItem({ report }: { report: CrowdsourceReport }) {
  const port = englishDisplayText(report.port);
  return (
    <article className={styles.item}>
      <div className={`${styles.avatar} ${styles[report.crowd_level]}`}>
        {port.slice(0, 1)}
      </div>
      <div>
        <div className={styles.meta}>
          <strong>{port} · {report.actual_wait_time} minutes</strong>
          <span>{englishDisplayText(report.time_label)}</span>
        </div>
        <p>{englishDisplayText(report.comment)}</p>
        <div className={styles.details}>
          <small>@{report.user_id} · {CROWD_LABELS[report.crowd_level]}</small>
          <span className={`${styles.quality} ${styles[report.quality_level]}`}>
            {QUALITY_LABELS[report.quality_level]} · score {report.quality_score}
          </span>
          <small>
            Valid until {formatClock(report.expires_at)}
            {!report.used_for_prediction && " · Not used for prediction"}
          </small>
          <small>Classroom Demo report · Excluded from training data</small>
        </div>
      </div>
    </article>
  );
}
