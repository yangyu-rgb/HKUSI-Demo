import { useState, type FormEvent } from "react";
import { FeedItem } from "../features/crowdsource/FeedItem";
import { useCrowdsource } from "../features/crowdsource/useCrowdsource";
import type { CrowdLevel } from "../features/realtime/types";
import { useRealtime } from "../features/realtime/useRealtime";
import { ErrorState, LoadingState } from "../shared/components/PageState";
import styles from "./CrowdsourcePage.module.css";


const CROWD_LABELS: Record<CrowdLevel, string> = {
  low: "畅通",
  medium: "正常",
  high: "拥挤",
};


export function CrowdsourcePage() {
  const realtime = useRealtime();
  const crowdsource = useCrowdsource();
  const [port, setPort] = useState("福田");
  const [wait, setWait] = useState(12);
  const [crowd, setCrowd] = useState<CrowdLevel>("low");
  const [comment, setComment] = useState("排队很短，通关顺畅。");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const submitted = await crowdsource.submit({
      user_id: "demo-user",
      port,
      actual_wait_time: wait,
      crowd_level: crowd,
      comment,
    });
    if (submitted) {
      await realtime.refresh();
    }
  }

  if (realtime.loading || crowdsource.loading) {
    return <LoadingState label="正在载入现场反馈…" />;
  }
  if (!realtime.data) {
    return <ErrorState title="无法载入众包页面" detail={realtime.error || "口岸数据不可用"} />;
  }

  return (
    <main className="page">
      <div className="pageIntro">
        <span className="sectionKicker">Human-in-the-loop</span>
        <h1>现场反馈让预测持续校准</h1>
        <p>每一条真实等待时间都会参与演示模型的加权计算。偏差超过5分钟时，系统标记一次模型更新。</p>
      </div>
      <section className={styles.grid}>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.formRow}>
            <label>
              <span>所在口岸</span>
              <select value={port} onChange={(event) => setPort(event.target.value)}>
                {realtime.data.ports.map((item) => (
                  <option key={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>实际等待</span>
              <div className={styles.unitInput}>
                <input
                  type="number"
                  min="0"
                  max="180"
                  value={wait}
                  onChange={(event) => setWait(Number(event.target.value))}
                />
                <b>分钟</b>
              </div>
            </label>
          </div>
          <label>
            <span>现场人流</span>
            <div className={styles.segmented}>
              {(["low", "medium", "high"] as CrowdLevel[]).map((level) => (
                <button
                  type="button"
                  className={crowd === level ? styles.active : ""}
                  onClick={() => setCrowd(level)}
                  key={level}
                >
                  {CROWD_LABELS[level]}
                </button>
              ))}
            </div>
          </label>
          <label>
            <span>补充说明</span>
            <input value={comment} onChange={(event) => setComment(event.target.value)} maxLength={160} />
          </label>
          <button className="button buttonAccent" disabled={crowdsource.submitting}>
            {crowdsource.submitting ? "正在提交…" : "提交反馈 · +10积分"}
          </button>
          {crowdsource.message && <p className="formSuccess">{crowdsource.message}</p>}
          {crowdsource.error && <p className="formError">{crowdsource.error}</p>}
        </form>

        <div className={styles.feedPanel}>
          <div className={styles.feedHeader}>
            <h2>最新现场动态</h2>
            <span>{crowdsource.reports.length} 条展示中</span>
          </div>
          <div className={styles.feedList}>
            {crowdsource.reports.map((report) => <FeedItem report={report} key={report.id} />)}
          </div>
        </div>
      </section>
    </main>
  );
}
