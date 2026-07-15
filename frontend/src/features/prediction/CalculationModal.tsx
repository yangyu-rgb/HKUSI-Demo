import { useEffect, useRef } from "react";
import type { PortPrediction } from "./types";
import styles from "./CalculationModal.module.css";

type Props = {
  route: PortPrediction;
  trigger: HTMLButtonElement | null;
  onClose: () => void;
};

export function CalculationModal({ route, trigger, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const official = route.official_calibration;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      window.setTimeout(() => trigger?.focus(), 0);
    };
  }, [trigger]);

  function close() {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else {
      dialog.removeAttribute("open");
      onClose();
    }
  }

  return (
    <dialog
      aria-labelledby="calculation-title"
      className={styles.dialog}
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className={styles.sheet}>
        <header className={styles.header}>
          <div>
            <span>AI calculation trace</span>
            <h2 id="calculation-title">{route.name_en} Port · Full calculation</h2>
            <p>An explainable trace from the model baseline through official calibration and crowd adjustment to the final forecast.</p>
          </div>
          <button className={styles.close} type="button" aria-label="Close calculation" onClick={close}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </header>

        <section className={styles.pipeline} aria-label="Wait-time calculation pipeline">
          {[
            ["AI baseline", official.raw_model_wait_minutes],
            ["Scenario calibration", official.scenario_adjusted_wait_minutes],
            ["Official-status calibration", official.queue_adjusted_wait_minutes],
            ["Crowd adjustment", official.crowdsource_adjustment_minutes],
            ["Final wait", route.predicted_wait_time],
          ].map(([label, value], index) => (
            <div className={index === 4 ? styles.finalStep : undefined} key={String(label)}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <small>{label}</small>
              <strong>{Number(value) >= 0 && index === 3 ? "+" : ""}{String(value ?? "—")} min</strong>
            </div>
          ))}
        </section>

        <div className={styles.detailGrid}>
          <section className={styles.panel}>
            <h3>Calibration inputs</h3>
            <dl>
              <div><dt>Official data status</dt><dd>{official.status ?? "missing"}</dd></div>
              <div><dt>Passenger pressure</dt><dd>{official.traffic?.pressure?.toFixed(2) ?? "—"}</dd></div>
              <div><dt>15-minute status weight</dt><dd>{official.queue?.effective_weight ? `${Math.round(official.queue.effective_weight * 100)}%` : "Not applied"}</dd></div>
              <div><dt>Uncertainty increment</dt><dd>±{official.uncertainty_minutes ?? route.uncertainty_minutes} min</dd></div>
            </dl>
          </section>
          <section className={styles.panel}>
            <h3>Shenzhen-side cross-check</h3>
            {official.shenzhen_validation?.available ? (
              <>
                <strong className={styles.validation}>{official.shenzhen_validation.agreement_percent}% pressure agreement</strong>
                <p>The validated forecast-interval multiplier is ×{official.shenzhen_validation.uncertainty_multiplier}.</p>
              </>
            ) : (
              <p>{official.shenzhen_validation?.reason ?? "No Shenzhen-side snapshot is available; the calculation uses Hong Kong official data only."}</p>
            )}
          </section>
        </div>

        <section className={styles.factors}>
          <h3>Factor details</h3>
          <ul>
            {route.factors.map((factor, index) => {
              const weight = factor.effective_weight === undefined
                ? null
                : Math.round(Number(factor.effective_weight) * 100);
              return (
                <li key={`${String(factor.code)}-${index}`}>
                  <div>
                    <strong>{String(factor.label ?? factor.code)}</strong>
                    <span>
                      {factor.value_minutes !== undefined && `${String(factor.value_minutes)} min`}
                      {factor.value_multiplier !== undefined && `Multiplier ×${String(factor.value_multiplier)}`}
                      {weight !== null && ` · Weight ${weight}%`}
                      {factor.average_quality_score !== undefined && ` · Average quality ${String(factor.average_quality_score)}`}
                    </span>
                  </div>
                  {weight !== null && (
                    <div className={styles.bar} aria-label={`Effective weight ${weight}%`}>
                      <i style={{ width: `${Math.max(4, Math.min(100, weight))}%` }} />
                    </div>
                  )}
                  {factor.detail !== undefined && <p>{String(factor.detail)}</p>}
                </li>
              );
            })}
          </ul>
        </section>

        <footer className={styles.footer}>
          <p>Demo results support route comparison and do not represent an official crossing commitment.</p>
          <button type="button" onClick={close}>Done</button>
        </footer>
      </div>
    </dialog>
  );
}
