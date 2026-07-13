import { useState } from "react";
import { PlannerForm } from "../features/prediction/PlannerForm";
import { CalculationModal } from "../features/prediction/CalculationModal";
import { Link } from "react-router-dom";
import { RouteCard } from "../features/prediction/RouteCard";
import { RouteSchematic } from "../features/prediction/RouteSchematic";
import { usePrediction } from "../features/prediction/usePrediction";
import type { PortPrediction } from "../features/prediction/types";
import { ErrorState } from "../shared/components/PageState";
import { PageSkeleton } from "../shared/components/PageSkeleton";
import styles from "./PlannerPage.module.css";


export function PlannerPage() {
  const [calculation, setCalculation] = useState<{
    route: PortPrediction;
    trigger: HTMLButtonElement;
  } | null>(null);
  const {
    locations,
    context,
    prediction,
    query,
    setQuery,
    loading,
    predicting,
    error,
    runPrediction,
    clearPrediction,
  } = usePrediction();

  if (loading) {
    return <PageSkeleton cards={2} />;
  }
  if (!locations || !context) {
    return <ErrorState title="无法载入路线规划" detail={error || "地点数据不可用"} />;
  }
  const recommendedRoute = prediction?.ports.find(
    (route) => route.port_id === prediction.recommended_port_id,
  );

  return (
    <main className="page">
      <section className={styles.planner}>
        <div className={styles.panel}>
          <div className="sectionHeading stacked">
            <div><span className="sectionKicker">AI route planner</span><h1>跨境路线预测</h1></div>
            <p>选择地点和最迟到达时间，系统计算四口岸的最晚出发、预算与准时可达性。</p>
          </div>
          <PlannerForm
            locations={locations}
            query={query}
            setQuery={setQuery}
            predicting={predicting}
            minTargetTime={context.min_target_time}
            maxTargetTime={context.max_target_time}
            onSubmit={runPrediction}
          />
          {error && <p className="formError">{error}</p>}
        </div>

        {prediction && (
          <div className={styles.results}>
            <div className={styles.summary}>
              <span>本次推荐</span>
              <h2>{prediction.recommended}口岸</h2>
              <p>{prediction.reason}</p>
              <small>{prediction.model_version} · {Math.round(prediction.confidence_level * 100)}%置信水平 · {prediction.demo_notice}</small>
              {prediction.scenario && (
                <small>{prediction.prediction_engine === "v2" ? "AI V2 主预测" : "统计模型自动降级"} · 场景 {String(prediction.scenario.weather)} · 版本 {String(prediction.scenario.version)}</small>
              )}
              {prediction.forecast_run_id && recommendedRoute && (
                <Link
                  className={styles.feedbackLink}
                  to={`/crowdsource?forecast_run_id=${encodeURIComponent(prediction.forecast_run_id)}&forecast_port_id=${encodeURIComponent(recommendedRoute.port_id)}&direction=${encodeURIComponent(prediction.direction)}`}
                >
                  通关后反馈实际等待
                </Link>
              )}
              <button className={styles.clearButton} type="button" onClick={clearPrediction}>清除方案</button>
            </div>
            {prediction.warnings.map((warning) => (
              <p className={styles.warning} key={warning}>{warning}</p>
            ))}
            {recommendedRoute && (
              <RouteSchematic
                origin={prediction.query.origin_name}
                destination={prediction.query.destination_name}
                route={recommendedRoute}
              />
            )}
            <div className={styles.routeGrid}>
              {prediction.ports.map((route) => (
                <RouteCard
                  route={route}
                  recommended={route.port_id === prediction.recommended_port_id}
                  onShowCalculation={(trigger) => setCalculation({ route, trigger })}
                  key={route.port_id}
                />
              ))}
            </div>
          </div>
        )}
        {!prediction && (
          <section className={styles.emptyState} aria-live="polite">
            <span>01</span>
            <div><h2>选择通勤条件，生成你的四口岸方案</h2><p>目前还没有预测结果。确认出发地、目的地和最迟到达时间后，点击“生成 AI 建议”。</p></div>
            <div className={styles.emptySteps}><b>选择固定地点</b><i>→</i><b>设定到达要求</b><i>→</i><b>比较四个口岸</b></div>
          </section>
        )}
      </section>
      {calculation && (
        <CalculationModal
          route={calculation.route}
          trigger={calculation.trigger}
          onClose={() => setCalculation(null)}
        />
      )}
    </main>
  );
}
