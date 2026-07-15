import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useDemoContext } from "../features/demo/useDemo";
import { fetchLocations, fetchPrediction } from "../features/prediction/api";
import { DEFAULT_QUERY } from "../features/prediction/usePrediction";
import type { PredictionQueryInput, Priority } from "../features/prediction/types";
import { userFacingError } from "../shared/api/client";
import { PageSkeleton } from "../shared/components/PageSkeleton";
import { formatClock } from "../shared/formatters";
import { queryKeys } from "../shared/queryKeys";
import { useMobileSession } from "./MobileSession";
import styles from "./MobilePages.module.css";


export function MobilePlannerPage() {
  const session = useMobileSession();
  const locations = useQuery({ queryKey: queryKeys.locations, queryFn: fetchLocations, staleTime: Infinity });
  const context = useDemoContext();
  const [query, setQuery] = useState<PredictionQueryInput>(session.query ?? DEFAULT_QUERY);
  const prediction = useMutation({
    mutationFn: fetchPrediction,
    onSuccess: (result, submitted) => session.savePrediction(submitted, result),
  });

  useEffect(() => {
    if (!context.data || query.target_time) return;
    setQuery((current) => ({ ...current, target_time: context.data!.suggested_target_time.slice(0, 16) }));
  }, [context.data, query.target_time]);

  const selectedDirection = useMemo(() => locations.data?.directions.find(
    (item) => item.id === query.direction,
  ) ?? locations.data?.directions[0], [locations.data, query.direction]);
  const origins = locations.data?.origins.filter((item) => selectedDirection?.origin_ids.includes(item.id)) ?? [];
  const destinations = locations.data?.destinations.filter((item) => selectedDirection?.destination_ids.includes(item.id)) ?? [];
  const result = prediction.data ?? session.prediction;
  const recommended = result?.ports.find((item) => item.port_id === result.recommended_port_id);

  function submit(event: FormEvent) {
    event.preventDefault();
    prediction.mutate(query);
  }

  if (locations.isPending || context.isPending) return <PageSkeleton cards={2} />;
  if (!locations.data || !context.data) {
    return <main className={styles.page}><p className={styles.error}>{userFacingError(locations.error ?? context.error)}</p></main>;
  }

  return (
    <main className={styles.page}>
      <div className={styles.intro}><span>AI route planner</span><h1>Plan a cross-border journey</h1><p>Enter an arrival target to compare four ports and get a route directly on mobile.</p></div>
      <section className={styles.card}>
        <form className={styles.form} onSubmit={submit}>
          <label>Travel direction<select aria-label="Mobile travel direction" value={query.direction} onChange={(event) => {
            const direction = locations.data!.directions.find((item) => item.id === event.target.value) ?? locations.data!.directions[0];
            setQuery({ ...query, direction: direction.id, origin_id: direction.origin_ids[0], destination_id: direction.destination_ids[0] });
          }}>{locations.data.directions.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
          <div className={styles.row}>
            <label>Origin<select aria-label="Mobile origin" value={query.origin_id} onChange={(event) => setQuery({ ...query, origin_id: event.target.value })}>{origins.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
            <label>Destination<select aria-label="Mobile destination" value={query.destination_id} onChange={(event) => setQuery({ ...query, destination_id: event.target.value })}>{destinations.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          </div>
          <label>Latest arrival<input aria-label="Mobile latest arrival" type="datetime-local" required min={context.data.min_target_time.slice(0,16)} max={context.data.max_target_time.slice(0,16)} value={query.target_time} onChange={(event) => setQuery({ ...query, target_time: event.target.value })} /></label>
          <div className={styles.row}>
            <label>Route preference<select aria-label="Mobile route preference" value={query.priority} onChange={(event) => setQuery({ ...query, priority: event.target.value as Priority })}><option value="balanced">Balanced</option><option value="fastest">Fastest</option><option value="cheapest">Lowest cost</option></select></label>
            <label>Budget cap<input aria-label="Mobile budget cap" type="number" min="0" placeholder="No limit" value={query.max_budget ?? ""} onChange={(event) => setQuery({ ...query, max_budget: event.target.value === "" ? null : Number(event.target.value) })} /></label>
          </div>
          <button className={styles.button} disabled={prediction.isPending}>{prediction.isPending ? "AI is calculating…" : session.predictionStale ? "Recalculate with new report" : "Generate AI recommendation"}</button>
          {prediction.error && <p className={styles.error}>{userFacingError(prediction.error)}</p>}
        </form>
      </section>

      {result && recommended && (
        <section aria-live="polite">
          {session.predictionStale && <p className={styles.message}>An on-site report was updated. Recalculate to see the latest calibration.</p>}
          <div className={styles.resultHero}>
            <small>Recommendation · {result.query.origin_name} → {result.query.destination_name}</small>
            <h2>{result.recommended} Port</h2><p>{result.reason}</p>
            <div className={styles.metrics}>
              <div><strong>{recommended.predicted_wait_time} min</strong><span>Estimated wait</span></div>
              <div><strong>{recommended.total_time} min</strong><span>Total trip</span></div>
              <div><strong>{recommended.late_risk_percent}%</strong><span>Late risk</span></div>
            </div>
          </div>
          <div className={styles.card}>
            <h2>Departure recommendation</h2>
            <div className={styles.list}><article><header><strong>Depart by {formatClock(recommended.latest_departure)}</strong><b>HK${recommended.total_cost}</b></header><p>90% interval {recommended.confidence_interval[0]}–{recommended.confidence_interval[1]} minutes · Safety buffer {recommended.buffer_minutes} minutes</p></article></div>
            {result.forecast_run_id && <Link className={styles.linkButton} to={`/mobile/feedback?forecast_run_id=${encodeURIComponent(result.forecast_run_id)}&forecast_port_id=${encodeURIComponent(recommended.port_id)}&direction=${encodeURIComponent(result.direction)}`}>Report actual wait after crossing</Link>}
          </div>
          <div className={styles.list}>
            {result.ports.map((route) => <details key={route.port_id} open={route.port_id === result.recommended_port_id}><summary>{route.name_en} · {route.predicted_wait_time} minutes · HK${route.total_cost}</summary><p>Total trip {route.total_time} minutes, late risk {route.late_risk_percent}%, 90% interval {route.confidence_interval[0]}–{route.confidence_interval[1]} minutes.</p></details>)}
          </div>
        </section>
      )}
    </main>
  );
}
