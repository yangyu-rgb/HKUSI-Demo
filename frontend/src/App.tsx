import { useEffect, useMemo, useState } from "react";
import { fetchDemoState } from "./api";
import type { DemoState, TopicId } from "./types";

const TOPICS: Array<{ id: TopicId; label: string }> = [
  { id: "wastewise", label: "WasteWise" },
  { id: "clinicflow", label: "ClinicFlow" },
  { id: "hireready", label: "HireReady" }
];

function App() {
  const [topic, setTopic] = useState<TopicId>("wastewise");
  const [state, setState] = useState<DemoState | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    setStatus("loading");
    fetchDemoState(topic)
      .then((demoState) => {
        setState(demoState);
        setStatus("ready");
      })
      .catch(() => {
        setStatus("error");
      });
  }, [topic]);

  const maxForecast = useMemo(() => {
    if (!state) return 1;
    return Math.max(...state.table.map((row) => Math.max(row.baseline, row.forecast)), 1);
  }, [state]);

  if (status === "error") {
    return (
      <main className="shell">
        <section className="error-panel">
          <h1>Backend unavailable</h1>
          <p>Start the FastAPI backend on http://127.0.0.1:8000, then refresh this page.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">SIUS2612 Topic 2 Demo</p>
          <h1>{state?.title ?? "Loading demo"}</h1>
          <p>{state?.subtitle ?? "Loading local AI dashboard..."}</p>
        </div>

        <div className="topic-switcher" aria-label="Select topic">
          {TOPICS.map((item) => (
            <button
              key={item.id}
              className={item.id === topic ? "active" : ""}
              onClick={() => setTopic(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      <section className="workspace">
        <aside className="control-panel">
          <h2>Scenario</h2>
          <div className="scenario-card">
            <span>Loaded sample</span>
            <strong>{state?.scenario ?? "Loading"}</strong>
          </div>
          <button className="primary-button">Load Sample Data</button>
          <button className="secondary-button">Run AI Analysis</button>
          <div className="note">
            Local deterministic analysis. No real API keys, external systems, or live data.
          </div>
        </aside>

        <section className="dashboard">
          <div className="metrics-grid">
            {(state?.metrics ?? []).map((metric) => (
              <article className="metric-card" key={metric.label}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <p>{metric.trend}</p>
              </article>
            ))}
          </div>

          <section className="panel">
            <div className="panel-heading">
              <h2>AI Analysis</h2>
              <span>Model output translated into manager-facing insight</span>
            </div>
            <div className="analysis-grid">
              {(state?.analysis ?? []).map((card) => (
                <article className="analysis-card" key={card.title}>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="panel split-panel">
            <div>
              <div className="panel-heading">
                <h2>Baseline vs AI Forecast</h2>
                <span>Comparison view for pitch demo</span>
              </div>
              <div className="chart-table">
                {(state?.table ?? []).map((row) => (
                  <div className="chart-row" key={row.item}>
                    <div className="chart-label">
                      <strong>{row.item}</strong>
                      <span>{row.risk} risk</span>
                    </div>
                    <div className="bars">
                      <div className="bar-line">
                        <span>Baseline</span>
                        <div className="bar-track">
                          <div
                            className="bar baseline"
                            style={{ width: `${(row.baseline / maxForecast) * 100}%` }}
                          />
                        </div>
                        <b>{row.baseline}</b>
                      </div>
                      <div className="bar-line">
                        <span>AI</span>
                        <div className="bar-track">
                          <div
                            className="bar forecast"
                            style={{ width: `${(row.forecast / maxForecast) * 100}%` }}
                          />
                        </div>
                        <b>{row.forecast}</b>
                      </div>
                    </div>
                    <em>{row.action}</em>
                  </div>
                ))}
              </div>
            </div>

            <div className="recommendation-box">
              <h2>Recommendations</h2>
              <ol>
                {(state?.recommendations ?? []).map((recommendation) => (
                  <li key={recommendation}>{recommendation}</li>
                ))}
              </ol>
            </div>
          </section>

          {state && (
            <section className="report-panel">
              <div>
                <h2>Impact Report</h2>
                <p>{state.report.headline}</p>
              </div>
              <div className="report-metrics">
                <strong>{state.report.primaryMetric}</strong>
                <span>{state.report.secondaryMetric}</span>
              </div>
              <div className="next-step">{state.report.nextStep}</div>
            </section>
          )}
        </section>
      </section>
    </main>
  );
}

export default App;

