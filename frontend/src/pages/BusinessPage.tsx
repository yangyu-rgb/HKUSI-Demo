import { useState } from "react";
import { createBatchPlan } from "../features/business/api";
import type { BatchPlanResponse } from "../features/business/types";
import styles from "./BusinessPage.module.css";


export function BusinessPage() {
  const [plan, setPlan] = useState<BatchPlanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGenerate() {
    setLoading(true);
    setError("");
    try {
      setPlan(await createBatchPlan());
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "调度方案生成失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <div className="pageIntro">
        <span className="sectionKicker">B2B operations</span>
        <h1>企业批量通勤风险管理</h1>
        <p>为跨境巴士、物流团队和企业 HR 批量生成口岸选择、出发时间与迟到风险。</p>
      </div>
      <section className={styles.card}>
        <div className={styles.heading}>
          <div>
            <h2>大湾区跨境服务有限公司</h2>
            <p>4 名员工 · 2026年7月9日 · 本地确定性场景</p>
          </div>
          {!plan && (
            <button className="button buttonDark" onClick={() => void handleGenerate()} disabled={loading}>
              {loading ? "正在生成…" : "生成4人调度示例"}
            </button>
          )}
        </div>
        {error && <p className="formError">{error}</p>}
        {plan && (
          <div className={styles.result}>
            <div className={styles.stats}>
              <div><strong>{plan.summary.employee_count}</strong><span>员工</span></div>
              <div><strong>{plan.summary.avg_commute_time}</strong><span>平均分钟</span></div>
              <div><strong>{plan.summary.high_risk_count}</strong><span>高风险</span></div>
            </div>
            <div className={styles.table}>
              <div className={styles.tableHeader}>
                <span>员工</span><span>推荐口岸</span><span>出发时间</span><span>通勤时间</span><span>风险</span>
              </div>
              {plan.plan.map((item) => (
                <div className={styles.tableRow} key={item.employee_id}>
                  <strong>{item.employee_id}</strong>
                  <span>{item.recommended_port}</span>
                  <span>{item.departure_time}</span>
                  <span>{item.total_time} 分钟</span>
                  <span>{item.late_risk_percent}%</span>
                </div>
              ))}
            </div>
            <p className={styles.recommendation}>{plan.summary.recommendation}</p>
          </div>
        )}
      </section>
    </main>
  );
}
