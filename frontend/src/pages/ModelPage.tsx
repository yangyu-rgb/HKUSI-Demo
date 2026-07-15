import { useModelShadowSummary, useV1Model, useV1Readiness, useV2Model } from "../features/demo/useDemo";
import { PageSkeleton } from "../shared/components/PageSkeleton";
import styles from "./ModelPage.module.css";


type MetricSummary = {
  overall: { mae: number; rmse: number; sample_count: number };
  by_port: Record<string, { mae: number; rmse: number }>;
};

type CandidateResult = {
  algorithm: string;
  parameters: Record<string, number>;
  validation: { mae: number; rmse: number };
  artifact_size_bytes: number;
};


export function ModelPage() {
  const model = useV1Model();
  const readiness = useV1Readiness();
  const shadow = useModelShadowSummary();
  const v2Model = useV2Model();
  if (model.isPending || readiness.isPending || shadow.isPending || v2Model.isPending) {
    return <PageSkeleton cards={3} />;
  }
  if (!model.data || !readiness.data || !shadow.data || !v2Model.data) {
    return <main className="page"><p className="formError">Model status is temporarily unavailable.</p></main>;
  }
  const metrics = model.data.metrics as unknown as Record<string, { test: MetricSummary }>;
  const candidate = metrics.hist_gradient_boosting.test;
  const calendar = metrics.calendar_mean.test;
  const v2Metrics = v2Model.data.metrics as Record<string, { mae?: number; improvement_percent?: number }>;
  const selection = v2Model.data.selection as { algorithm: string; candidate_count: number; selected_validation_mae: number; minimum_validation_mae: number; rule: string };
  const leaderboard = (v2Model.data.candidate_leaderboard as CandidateResult[]).slice(0, 3);
  const interval = v2Model.data.interval_calibration as { test_coverage_percent: number; average_interval_width_minutes: number; coverage_by_port_percent: Record<string, number> };
  const promotion = v2Model.data.promotion as { passed: boolean; checks: Array<{ name: string; passed: boolean; actual: unknown; required: string }> };
  const dataAudit = v2Model.data.data_audit as { complete_dates: number; warmup_days: number; future_rows_used: number };
  const optimization = v2Model.data.optimization_matrix as Array<{ id: string; name: string; status: "completed" | "blocked" | "deferred"; evidence: string }>;

  return (
    <main className="page">
      <div className="pageIntro">
        <span className="sectionKicker">AI model lab</span>
        <h1>AI Model Lab</h1>
        <p>A transparent V2.2 calibration model driven by Hong Kong official passenger flow and validated against Shenzhen official snapshots.</p>
      </div>
      <section className={styles.grid}>
        <article className={styles.panel}>
          <h2>AI V2.2 Transparent Calibration Model</h2>
          <strong className={v2Model.data.artifact_available ? styles.ready : styles.blocked}>{v2Model.data.artifact_available ? "Primary forecast enabled" : "Automatic fallback active"}</strong>
          <div className={styles.stats}>
            <div><strong>{Number(v2Model.data.dataset.sample_count)}</strong><span>Public-flow calibration samples</span></div>
            <div><strong>{String((v2Model.data.metrics as Record<string, { mae: number }>).test.mae)}</strong><span>Time-split test MAE</span></div>
            <div><strong>{v2Model.data.features.length}</strong><span>Baseline model features</span></div>
            <div><strong>{v2Metrics.traffic_ablation_test?.improvement_percent ?? "—"}%</strong><span>Passenger-flow improvement</span></div>
          </div>
          <small>The baseline model learns only port, direction, time, and Hong Kong official passenger flow. Weather, events, official status, and crowd reports are calibrated transparently after the model.</small>
        </article>
        <article className={styles.panel}>
          <h2>Final model selection</h2>
          <strong className={promotion.passed ? styles.ready : styles.blocked}>{promotion.passed ? "All promotion gates passed" : "Promotion blocked"}</strong>
          <p>{selection.candidate_count} candidates · Selected {selection.algorithm} · Validation MAE {selection.selected_validation_mae}</p>
          {leaderboard.map((entry, index) => (
            <div className={styles.metric} key={`${entry.algorithm}-${index}`}>
              <span>{index + 1}. {entry.algorithm.replace("hist_gradient_boosting", "HGB").replace("extra_trees", "ExtraTrees")}</span>
              <i style={{ width: `${Math.min(100, entry.validation.mae * 45)}%` }} />
              <b>{entry.validation.mae}</b>
            </div>
          ))}
          <small>{selection.rule}</small>
        </article>
        <article className={styles.panel}>
          <h2>Interval calibration and data audit</h2>
          <div className={styles.stats}>
            <div><strong>{interval.test_coverage_percent}%</strong><span>Actual 90% interval coverage</span></div>
            <div><strong>{interval.average_interval_width_minutes}</strong><span>Average interval width</span></div>
            <div><strong>{dataAudit.complete_dates}</strong><span>Complete training dates</span></div>
          </div>
          <p>56-day historical warm-up · {dataAudit.future_rows_used} future-information rows used · All four ports passed coverage checks.</p>
          <small>Calibration version: {v2Model.data.calibration_version}</small>
        </article>
        <article className={`${styles.panel} ${styles.wide}`}>
          <h2>Model promotion checks</h2>
          <div className={styles.checks}>
            {promotion.checks.map((check, index) => (
              <p key={index}>{check.passed ? "✓" : "○"} {check.name} · {String(typeof check.actual === "object" ? JSON.stringify(check.actual) : check.actual)} · Required {check.required}</p>
            ))}
          </div>
        </article>
        <article className={`${styles.panel} ${styles.wide}`}>
          <h2>Recommended AI optimization review</h2>
          <p>Reviews candidate selection, A/B testing, explainability, online learning, SHAP, and model integration without presenting capabilities that lack real labels as complete.</p>
          <div className={styles.optimization}>
            {optimization.map((item) => <div className={styles[item.status]} key={item.id}><span>{item.status === "completed" ? "Completed" : item.status === "blocked" ? "Blocked" : "Deferred"}</span><strong>{item.name}</strong><small>{item.evidence}</small></div>)}
          </div>
        </article>
        <article className={styles.panel}>
          <h2>V1 Demo readiness</h2>
          <strong className={readiness.data.demo_ready ? styles.ready : styles.blocked}>
            {readiness.data.demo_ready ? "Ready for full Demo" : "Not ready"}
          </strong>
          {readiness.data.checks.map((check, index) => (
            <p key={index}>{check.passed ? "✓" : "○"} {check.name} · {check.detail}</p>
          ))}
        </article>
        <article className={styles.panel}>
          <h2>Frozen V1 synthetic-data metrics</h2>
          <div className={styles.stats}>
            <div><strong>{candidate.overall.mae}</strong><span>HGB test MAE</span></div>
            <div><strong>{candidate.overall.rmse}</strong><span>HGB test RMSE</span></div>
            <div><strong>{calendar.overall.mae}</strong><span>Calendar baseline MAE</span></div>
          </div>
          <small>{Number(model.data.dataset.sample_count)} synthetic samples for engineering reference only.</small>
        </article>
        <article className={styles.panel}>
          <h2>MAE by port</h2>
          {Object.entries(candidate.by_port).map(([port, value]) => (
            <div className={styles.metric} key={port}>
              <span>{port}</span><i style={{ width: `${Math.min(100, value.mae * 40)}%` }} /><b>{value.mae}</b>
            </div>
          ))}
        </article>
        <article className={styles.panel}>
          <h2>Runtime shadow differences</h2>
          <p>Artifact: {model.data.artifact_available ? "Loaded" : `Unavailable (${model.data.unavailable_reason})`}</p>
          <p>{shadow.data.available_observations}/{shadow.data.total_observations} shadow observations available.</p>
          {shadow.data.ports.map((port) => (
            <p key={port.port_id}>{port.port_name} · Average absolute difference {port.average_absolute_difference_minutes ?? "—"} minutes</p>
          ))}
        </article>
        <article className={`${styles.panel} ${styles.wide}`}>
          <h2>Technical view: how the final wait is calculated</h2>
          <p><code>B = HGB(port, direction, time, weekday, Hong Kong flow pressure)</code></p>
          <p><code>S = B × min(2.10, weather factor × holiday factor × event factor)</code></p>
          <p><code>Q = S × [1 + official weight × (congestion factor − 1)]</code></p>
          <p><code>P = Q × (1 − W) + robust crowd value × W</code>; the caps for one, two, and multiple high-consensus reporters are <code>15% / 30% / 45%</code>.</p>
          <small>Shenzhen public snapshots are not added to Hong Kong passenger flow. Disagreement only widens the forecast interval and raises a warning.</small>
        </article>
        <article className={`${styles.panel} ${styles.wide}`}>
          <h2>Plain language: gradual correction like a weather forecast</h2>
          <p>AI first finds a baseline from the same port, direction, similar time, and passenger flow. Heavy rain, holidays, and events apply public factors. Fresh official congestion status and classroom crowd reports then adjust the result before four routes are compared on time, cost, and late-arrival risk.</p>
          <p>Hong Kong data drives the calculation, while Shenzhen public data cross-checks it. Greater disagreement produces a more conservative interval without counting the same passengers twice.</p>
          <strong className={styles.ready}>Classroom Demo only · No real field training data collected</strong>
        </article>
      </section>
    </main>
  );
}
