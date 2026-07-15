import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { FeedItem } from "../features/crowdsource/FeedItem";
import type { ReportInput } from "../features/crowdsource/types";
import { useCrowdsource } from "../features/crowdsource/useCrowdsource";
import type { CrowdLevel } from "../features/realtime/types";
import { useRealtime } from "../features/realtime/useRealtime";
import { ErrorState } from "../shared/components/PageState";
import { PageSkeleton } from "../shared/components/PageSkeleton";
import styles from "./CrowdsourcePage.module.css";


const CROWD_LABELS: Record<CrowdLevel, string> = {
  low: "Clear",
  medium: "Moderate",
  high: "Crowded",
};


export function CrowdsourcePage() {
  const [searchParams] = useSearchParams();
  const realtime = useRealtime();
  const crowdsource = useCrowdsource();
  const [port, setPort] = useState("Futian");
  const [wait, setWait] = useState<number | "">("");
  const [crowd, setCrowd] = useState<CrowdLevel>("low");
  const [comment, setComment] = useState("");
  const [direction, setDirection] = useState<NonNullable<ReportInput["direction"]>>(
    "hong_kong_to_shenzhen",
  );
  const [channel, setChannel] = useState<NonNullable<ReportInput["channel"]>>(
    "traveller",
  );
  const forecastRunId = searchParams.get("forecast_run_id");
  const forecastPortId = searchParams.get("forecast_port_id");
  const forecastDirection = searchParams.get("direction");

  useEffect(() => {
    if (!forecastPortId || !realtime.data) {
      return;
    }
    const matchedPort = realtime.data.ports.find((item) => item.id === forecastPortId);
    if (matchedPort) {
      setPort(matchedPort.name);
    }
  }, [forecastPortId, realtime.data]);

  useEffect(() => {
    if (
      forecastDirection === "hong_kong_to_shenzhen"
      || forecastDirection === "shenzhen_to_hong_kong"
    ) {
      setDirection(forecastDirection);
    }
  }, [forecastDirection]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (wait === "") {
      return;
    }
    const submitted = await crowdsource.submit({
      user_id: "demo-user",
      port,
      actual_wait_time: wait,
      crowd_level: crowd,
      comment,
      forecast_run_id: forecastRunId,
      forecast_port_id: forecastPortId,
      direction,
      channel,
    });
    if (submitted) {
      await realtime.refresh();
      setWait("");
      setComment("");
    }
  }

  if (realtime.loading || crowdsource.loading) {
    return <PageSkeleton cards={2} />;
  }
  if (!realtime.data) {
    return <ErrorState title="Unable to load crowd reports" detail={realtime.error || "Port data is unavailable."} />;
  }

  return (
    <main className="page">
      <div className="pageIntro">
        <span className="sectionKicker">Human-in-the-loop</span>
        <h1>On-site reports continuously calibrate forecasts</h1>
        <p>Reports are scored by freshness, wait deviation, and crowd consistency. Valid data is quality-weighted, and the same port cannot be submitted twice within 10 minutes.</p>
      </div>
      <section className={styles.grid}>
        <form className={styles.form} onSubmit={handleSubmit}>
          {forecastRunId && forecastPortId && (
            <p className={styles.forecastLink}>
              This report will be linked to the route forecast for classroom calibration, but it will not be collected as a real training label.
            </p>
          )}
          <div className={styles.formRow}>
            <label>
              <span>Port</span>
              <select value={port} onChange={(event) => setPort(event.target.value)}>
                {realtime.data.ports.map((item) => (
                  <option key={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            <label htmlFor="crowdsource-wait">
              <span>Actual wait</span>
              <div className={styles.unitInput}>
                <input
                  id="crowdsource-wait"
                  type="number"
                  min="0"
                  max="180"
                  required
                  value={wait}
                  placeholder="Enter actual wait"
                  onChange={(event) => setWait(
                    event.target.value === "" ? "" : Number(event.target.value),
                  )}
                />
                <b>min</b>
              </div>
            </label>
          </div>
          <div className={styles.formRow}>
            <label>
              <span>Travel direction</span>
              <select value={direction} onChange={(event) => setDirection(
                event.target.value as NonNullable<ReportInput["direction"]>,
              )}>
                <option value="hong_kong_to_shenzhen">Hong Kong → Shenzhen</option>
                <option value="shenzhen_to_hong_kong">Shenzhen → Hong Kong</option>
              </select>
            </label>
            <label>
              <span>Crossing type</span>
              <select value={channel} onChange={(event) => setChannel(
                event.target.value as NonNullable<ReportInput["channel"]>,
              )}>
                <option value="traveller">Traveller</option>
                <option value="vehicle">Vehicle</option>
                <option value="cargo">Freight</option>
              </select>
            </label>
          </div>
          <label>
            <span>Observed crowd level</span>
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
          <div className={styles.dataGovernance}>
            <strong>Classroom Demo data</strong>
            <small>One, two, and multiple high-consensus reporters use 15%, 30%, and 45% caps, then decay by quality, freshness, and forecast distance. No real field training labels are collected.</small>
          </div>
          <label>
            <span>Additional notes</span>
            <input
              value={comment}
              placeholder="Optional: describe the queue"
              onChange={(event) => setComment(event.target.value)}
              maxLength={160}
            />
          </label>
          <button className="button buttonAccent" disabled={crowdsource.submitting}>
            {crowdsource.submitting ? "Submitting…" : "Submit report"}
          </button>
          {crowdsource.message && <p className="formSuccess">{crowdsource.message}</p>}
          {crowdsource.calibrationPreview && (
            <div className={styles.calibrationPreview}>
              <strong>{Number(crowdsource.calibrationPreview.distinct_reporters)} independent reporters · Effective weight {Math.round(Number(crowdsource.calibrationPreview.effective_weight) * 100)}%</strong>
              <small>{String(crowdsource.calibrationPreview.reason)} · Current cap {Math.round(Number(crowdsource.calibrationPreview.weight_cap) * 100)}%</small>
            </div>
          )}
          {crowdsource.error && <p className="formError">{crowdsource.error}</p>}
        </form>

        <div className={styles.feedPanel}>
          <div className={styles.feedHeader}>
            <h2>Latest on-site activity</h2>
            <span>{crowdsource.reports.length} reports shown</span>
          </div>
          <div className={styles.feedList}>
            {crowdsource.reports.map((report) => <FeedItem report={report} key={report.id} />)}
          </div>
        </div>
      </section>
    </main>
  );
}
