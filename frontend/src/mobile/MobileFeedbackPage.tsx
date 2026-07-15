import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { ReportInput } from "../features/crowdsource/types";
import { useCrowdsource } from "../features/crowdsource/useCrowdsource";
import type { CrowdLevel } from "../features/realtime/types";
import { useRealtime } from "../features/realtime/useRealtime";
import { getDemoPersonaId } from "../shared/api/client";
import { PageSkeleton } from "../shared/components/PageSkeleton";
import { useMobileSession } from "./MobileSession";
import styles from "./MobilePages.module.css";


const crowdLabels: Record<CrowdLevel, string> = { low: "Clear", medium: "Moderate", high: "Crowded" };


export function MobileFeedbackPage() {
  const [searchParams] = useSearchParams();
  const realtime = useRealtime();
  const crowdsource = useCrowdsource();
  const session = useMobileSession();
  const forecastRunId = searchParams.get("forecast_run_id") ?? session.prediction?.forecast_run_id ?? null;
  const forecastPortId = searchParams.get("forecast_port_id") ?? session.prediction?.recommended_port_id ?? null;
  const forecastDirection = searchParams.get("direction") ?? session.prediction?.direction ?? "hong_kong_to_shenzhen";
  const [port, setPort] = useState("Futian");
  const [wait, setWait] = useState<number | "">("");
  const [crowd, setCrowd] = useState<CrowdLevel>("low");
  const [direction, setDirection] = useState<NonNullable<ReportInput["direction"]>>(
    forecastDirection === "shenzhen_to_hong_kong" ? forecastDirection : "hong_kong_to_shenzhen",
  );
  const [channel, setChannel] = useState<NonNullable<ReportInput["channel"]>>("traveller");
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!forecastPortId || !realtime.data) return;
    const matched = realtime.data.ports.find((item) => item.id === forecastPortId);
    if (matched) setPort(matched.name);
  }, [forecastPortId, realtime.data]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (wait === "") return;
    const ok = await crowdsource.submit({ user_id: getDemoPersonaId(), port, actual_wait_time: wait, crowd_level: crowd, comment, forecast_run_id: forecastRunId, forecast_port_id: forecastPortId, direction, channel });
    if (ok) {
      session.markPredictionStale();
      await realtime.refresh();
      setSubmitted(true); setWait(""); setComment("");
    }
  }

  if (realtime.loading || crowdsource.loading) return <PageSkeleton cards={2} />;
  if (!realtime.data) return <main className={styles.page}><p className={styles.error}>{realtime.error || "Port data is temporarily unavailable."}</p></main>;

  return (
    <main className={styles.page}>
      <div className={styles.intro}><span>Human in the loop</span><h1>Submit an on-site report</h1><p>Crowd reports use dynamic 15%/30%/45% caps based on independent reporters and consensus, and are never treated as real training labels.</p></div>
      <section className={styles.card}>
        {forecastRunId && <p className={styles.message}>Linked to the latest mobile route forecast.</p>}
        <form className={styles.form} onSubmit={submit}>
          <div className={styles.row}>
            <label>Port<select aria-label="Mobile report port" value={port} onChange={(event) => setPort(event.target.value)}>{realtime.data.ports.map((item) => <option key={item.id}>{item.name_en}</option>)}</select></label>
            <label>Actual wait<input aria-label="Mobile actual wait" type="number" min="0" max="180" required value={wait} placeholder="Minutes" onChange={(event) => setWait(event.target.value === "" ? "" : Number(event.target.value))} /></label>
          </div>
          <div className={styles.row}>
            <label>Travel direction<select aria-label="Mobile report direction" value={direction} onChange={(event) => setDirection(event.target.value as typeof direction)}><option value="hong_kong_to_shenzhen">Hong Kong → Shenzhen</option><option value="shenzhen_to_hong_kong">Shenzhen → Hong Kong</option></select></label>
            <label>Crossing type<select aria-label="Mobile crossing type" value={channel} onChange={(event) => setChannel(event.target.value as typeof channel)}><option value="traveller">Traveller</option><option value="vehicle">Vehicle</option><option value="cargo">Freight</option></select></label>
          </div>
          <div><small>Observed crowd level</small><div className={styles.chips}>{(["low","medium","high"] as CrowdLevel[]).map((level) => <button type="button" aria-pressed={crowd === level} onClick={() => setCrowd(level)} key={level}>{crowdLabels[level]}</button>)}</div></div>
          <label>Additional notes<textarea aria-label="Mobile report notes" maxLength={160} value={comment} placeholder="Optional: describe conditions" onChange={(event) => setComment(event.target.value)} /></label>
          <button className={styles.button} disabled={crowdsource.submitting}>{crowdsource.submitting ? "Submitting…" : "Submit report"}</button>
          {crowdsource.message && <p className={styles.message}>{crowdsource.message}</p>}
          {crowdsource.calibrationPreview && <p className={styles.message}>{Number(crowdsource.calibrationPreview.distinct_reporters)} independent reporters · Current effective weight {Math.round(Number(crowdsource.calibrationPreview.effective_weight) * 100)}% · {String(crowdsource.calibrationPreview.reason)}</p>}
          {crowdsource.error && <p className={styles.error}>{crowdsource.error}</p>}
          {submitted && session.prediction && <Link className={styles.linkButton} to="/mobile/planner">Return to planning and view the latest calibration</Link>}
        </form>
      </section>
      <section className={styles.card}><h2>Latest on-site activity</h2><div className={styles.list}>{crowdsource.reports.slice(0,4).map((report) => <article key={report.id}><header><strong>{report.port} · {report.actual_wait_time} minutes</strong><b>Score {report.quality_score}</b></header><p>{report.time_label} · {crowdLabels[report.crowd_level]} · {report.used_for_prediction ? "Used for calibration" : "Recorded only"}</p></article>)}</div></section>
    </main>
  );
}
