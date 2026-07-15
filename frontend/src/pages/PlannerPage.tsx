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
    return <ErrorState title="Unable to load route planning" detail={error || "Location data is unavailable."} />;
  }
  const recommendedRoute = prediction?.ports.find(
    (route) => route.port_id === prediction.recommended_port_id,
  );

  return (
    <main className="page">
      <section className={styles.planner}>
        <div className={styles.panel}>
          <div className="sectionHeading stacked">
            <div><span className="sectionKicker">AI route planner</span><h1>Cross-border route forecast</h1></div>
            <p>Select locations and a latest arrival time. The system compares latest departure, budget, and on-time feasibility across four ports.</p>
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
              <span>Recommended route</span>
              <h2>{prediction.recommended} Port</h2>
              <p>{prediction.reason}</p>
              <small>{prediction.model_version} · {Math.round(prediction.confidence_level * 100)}% confidence · {prediction.demo_notice}</small>
              {prediction.scenario && (
                <small>{prediction.prediction_engine === "v2" ? "AI V2 primary forecast" : "Statistical fallback"} · Scenario {String(prediction.scenario.weather)} · Version {String(prediction.scenario.version)}</small>
              )}
              {prediction.forecast_run_id && recommendedRoute && (
                <Link
                  className={styles.feedbackLink}
                  to={`/crowdsource?forecast_run_id=${encodeURIComponent(prediction.forecast_run_id)}&forecast_port_id=${encodeURIComponent(recommendedRoute.port_id)}&direction=${encodeURIComponent(prediction.direction)}`}
                >
                  Report actual wait after crossing
                </Link>
              )}
              <button className={styles.clearButton} type="button" onClick={clearPrediction}>Clear plan</button>
            </div>
            {prediction.warnings.map((warning, index) => (
              <p className={styles.warning} key={index}>{warning}</p>
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
            <div><h2>Select trip conditions to generate a four-port plan</h2><p>No forecast has been generated yet. Confirm the origin, destination, and latest arrival time, then select “Generate AI recommendation.”</p></div>
            <div className={styles.emptySteps}><b>Select locations</b><i>→</i><b>Set arrival target</b><i>→</i><b>Compare four ports</b></div>
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
