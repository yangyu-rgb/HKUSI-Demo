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
            <h2 id="calculation-title">{route.name}口岸 · 完整计算过程</h2>
            <p>从模型基础值到官方校准、众包修正与最终预测的可解释链路。</p>
          </div>
          <button className={styles.close} type="button" aria-label="关闭计算过程" onClick={close}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </header>

        <section className={styles.pipeline} aria-label="等待时间计算链路">
          {[
            ["AI 基础预测", official.raw_model_wait_minutes],
            ["场景校准", official.scenario_adjusted_wait_minutes],
            ["官方等级校准", official.queue_adjusted_wait_minutes],
            ["众包修正", official.crowdsource_adjustment_minutes],
            ["最终等待", route.predicted_wait_time],
          ].map(([label, value], index) => (
            <div className={index === 4 ? styles.finalStep : undefined} key={String(label)}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <small>{label}</small>
              <strong>{Number(value) >= 0 && index === 3 ? "+" : ""}{String(value ?? "—")} 分钟</strong>
            </div>
          ))}
        </section>

        <div className={styles.detailGrid}>
          <section className={styles.panel}>
            <h3>校准依据</h3>
            <dl>
              <div><dt>官方数据状态</dt><dd>{official.status ?? "missing"}</dd></div>
              <div><dt>客流压力</dt><dd>{official.traffic?.pressure?.toFixed(2) ?? "—"}</dd></div>
              <div><dt>15 分钟等级权重</dt><dd>{official.queue?.effective_weight ? `${Math.round(official.queue.effective_weight * 100)}%` : "当前未参与"}</dd></div>
              <div><dt>不确定性增量</dt><dd>±{official.uncertainty_minutes ?? route.uncertainty_minutes} 分钟</dd></div>
            </dl>
          </section>
          <section className={styles.panel}>
            <h3>深圳侧交叉核验</h3>
            {official.shenzhen_validation?.available ? (
              <>
                <strong className={styles.validation}>{official.shenzhen_validation.agreement_percent}% 压力一致度</strong>
                <p>核验后的预测区间系数为 ×{official.shenzhen_validation.uncertainty_multiplier}。</p>
              </>
            ) : (
              <p>{official.shenzhen_validation?.reason ?? "当前暂无深圳侧快照，按单侧官方数据计算。"}</p>
            )}
          </section>
        </div>

        <section className={styles.factors}>
          <h3>影响因子明细</h3>
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
                      {factor.value_minutes !== undefined && `${String(factor.value_minutes)} 分钟`}
                      {factor.value_multiplier !== undefined && `系数 ×${String(factor.value_multiplier)}`}
                      {weight !== null && ` · 权重 ${weight}%`}
                      {factor.average_quality_score !== undefined && ` · 平均质量 ${String(factor.average_quality_score)} 分`}
                    </span>
                  </div>
                  {weight !== null && (
                    <div className={styles.bar} aria-label={`有效权重 ${weight}%`}>
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
          <p>演示结果用于路线比较，不代表官方通关承诺。</p>
          <button type="button" onClick={close}>完成查看</button>
        </footer>
      </div>
    </dialog>
  );
}
