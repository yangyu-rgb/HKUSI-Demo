import { useModelShadowSummary, useV1Model, useV1Readiness, useV2Readiness } from "../features/demo/useDemo";
import { PageSkeleton } from "../shared/components/PageSkeleton";
import styles from "./ModelPage.module.css";


type MetricSummary = {
  overall: { mae: number; rmse: number; sample_count: number };
  by_port: Record<string, { mae: number; rmse: number }>;
};


export function ModelPage() {
  const model = useV1Model();
  const readiness = useV1Readiness();
  const shadow = useModelShadowSummary();
  const v2 = useV2Readiness();
  if (model.isPending || readiness.isPending || shadow.isPending || v2.isPending) {
    return <PageSkeleton cards={3} />;
  }
  if (!model.data || !readiness.data || !shadow.data || !v2.data) {
    return <main className="page"><p className="formError">模型状态暂时不可用。</p></main>;
  }
  const metrics = model.data.metrics as unknown as Record<string, { test: MetricSummary }>;
  const candidate = metrics.hist_gradient_boosting.test;
  const calendar = metrics.calendar_mean.test;

  return (
    <main className="page">
      <div className="pageIntro">
        <span className="sectionKicker">AI v1 shadow lab</span>
        <h1>V1 模型实验室</h1>
        <p>完整展示合成数据评估、运行时产物、影子差异和 V1/V2 两套独立门槛。</p>
      </div>
      <section className={styles.grid}>
        <article className={styles.panel}>
          <h2>V1 Demo readiness</h2>
          <strong className={readiness.data.demo_ready ? styles.ready : styles.blocked}>
            {readiness.data.demo_ready ? "可完整演示" : "尚未就绪"}
          </strong>
          {readiness.data.checks.map((check) => (
            <p key={check.name}>{check.passed ? "✓" : "○"} {check.name} · {check.detail}</p>
          ))}
        </article>
        <article className={styles.panel}>
          <h2>合成数据离线指标</h2>
          <div className={styles.stats}>
            <div><strong>{candidate.overall.mae}</strong><span>HGB 测试 MAE</span></div>
            <div><strong>{candidate.overall.rmse}</strong><span>HGB 测试 RMSE</span></div>
            <div><strong>{calendar.overall.mae}</strong><span>日历基线 MAE</span></div>
          </div>
          <small>{Number(model.data.dataset.sample_count)} 条合成样本，仅作工程参考。</small>
        </article>
        <article className={styles.panel}>
          <h2>分口岸 MAE</h2>
          {Object.entries(candidate.by_port).map(([port, value]) => (
            <div className={styles.metric} key={port}>
              <span>{port}</span><i style={{ width: `${Math.min(100, value.mae * 40)}%` }} /><b>{value.mae}</b>
            </div>
          ))}
        </article>
        <article className={styles.panel}>
          <h2>运行时影子差异</h2>
          <p>产物：{model.data.artifact_available ? "已加载" : `不可用（${model.data.unavailable_reason}）`}</p>
          <p>{shadow.data.available_observations}/{shadow.data.total_observations} 个影子预测点可用。</p>
          {shadow.data.ports.map((port) => (
            <p key={port.port_id}>{port.port_name} · 平均绝对差 {port.average_absolute_difference_minutes ?? "—"} 分钟</p>
          ))}
        </article>
        <article className={styles.panel}>
          <h2>V2 数据门槛</h2>
          <p>{v2.data.label_count}/200 条真实授权标签；当前{v2.data.experiment_ready ? "可实验" : "不可训练 V2"}。</p>
          <p>V1 就绪不会绕过真实数据、时间切分或生产晋级限制。</p>
        </article>
      </section>
    </main>
  );
}
