import { useState, type FormEvent } from "react";
import { createSubscription } from "../features/subscription/api";
import styles from "./AlertsPage.module.css";


export function AlertsPage() {
  const [arrivalDeadline, setArrivalDeadline] = useState("09:30");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    setError("");
    try {
      const result = await createSubscription({
        user_id: "demo-user",
        routine: {
          departure: "香港大学",
          destination: "深圳南山科技园",
          days: ["monday", "wednesday", "friday"],
          arrival_deadline: arrivalDeadline,
          priority: "balanced",
        },
        alerts: {
          advance_reminder: true,
          anomaly_alert: true,
          better_route_alert: true,
        },
      });
      setMessage(`${result.message} 编号：${result.subscription_id}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "提醒设置失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="page">
      <div className="pageIntro">
        <span className="sectionKicker">Proactive alert</span>
        <h1>不用反复查询，让最佳路线主动找你</h1>
        <p>先配置确定性的提醒示例；后续功能阶段将补充订阅列表、异常触发和替代路线预览。</p>
      </div>
      <section className={styles.card}>
        <div>
          <h2>香港大学 → 深圳南山科技园</h2>
          <p>每周一、三、五通勤 · 稳妥均衡优先</p>
        </div>
        <form onSubmit={handleSubmit}>
          <label>
            <span>计划到达时间</span>
            <input
              type="time"
              value={arrivalDeadline}
              onChange={(event) => setArrivalDeadline(event.target.value)}
            />
          </label>
          <div className={styles.checkList}>
            <span>✓ 出发前30分钟提醒</span>
            <span>✓ 异常拥堵预警</span>
            <span>✓ 更优路线提示</span>
          </div>
          <button className="button buttonLight" disabled={submitting}>
            {submitting ? "正在设置…" : "设置智能提醒"}
          </button>
        </form>
        {message && <p className={styles.success}>{message}</p>}
        {error && <p className={styles.error}>{error}</p>}
      </section>
    </main>
  );
}
