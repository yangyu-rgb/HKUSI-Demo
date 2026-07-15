import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useDemoContext } from "../features/demo/useDemo";
import { fetchLocations } from "../features/prediction/api";
import type { Priority } from "../features/prediction/types";
import type { ScenarioWrite } from "../features/scenario/api";
import { useScenarios } from "../features/scenario/useScenarios";
import { userFacingError } from "../shared/api/client";
import { PageSkeleton } from "../shared/components/PageSkeleton";
import { queryKeys } from "../shared/queryKeys";
import styles from "./MobilePages.module.css";


type PresetId = "heavy_rain" | "holiday" | "event" | "classroom";
const presetLabels: Record<PresetId, string> = { heavy_rain: "Heavy-rain commute", holiday: "Holiday peak", event: "Shenzhen Bay event", classroom: "Combined pressure" };


function makeScenario(id: PresetId): ScenarioWrite {
  const hasEvent = id === "event" || id === "classroom";
  return {
    weather: id === "heavy_rain" || id === "classroom" ? "heavy_rain" : "clear",
    is_holiday: id === "holiday" || id === "classroom",
    events: hasEvent ? [{ name: "Major Shenzhen Bay event", preset: "classroom_demo", direction: "hong_kong_to_shenzhen", affected_ports: ["深圳湾"], start_time: "00:00", end_time: "23:59", impact: "high" }] : [],
  };
}


export function MobileScenarioPage() {
  const { scenarios, compare } = useScenarios();
  const locations = useQuery({ queryKey: queryKeys.locations, queryFn: fetchLocations, staleTime: Infinity });
  const context = useDemoContext();
  const [selectedDate, setSelectedDate] = useState("");
  const [preset, setPreset] = useState<PresetId>("classroom");
  const [direction, setDirection] = useState<"hong_kong_to_shenzhen" | "shenzhen_to_hong_kong">("hong_kong_to_shenzhen");
  const [originId, setOriginId] = useState("hku");
  const [destinationId, setDestinationId] = useState("nanshan-tech");
  const [priority, setPriority] = useState<Priority>("balanced");

  useEffect(() => { if (!selectedDate && scenarios.data?.start) setSelectedDate(scenarios.data.start); }, [scenarios.data, selectedDate]);
  const selectedDirection = useMemo(() => locations.data?.directions.find((item) => item.id === direction), [locations.data, direction]);
  const origins = locations.data?.origins.filter((item) => selectedDirection?.origin_ids.includes(item.id)) ?? [];
  const destinations = locations.data?.destinations.filter((item) => selectedDirection?.destination_ids.includes(item.id)) ?? [];

  if (scenarios.isPending || locations.isPending || context.isPending) return <PageSkeleton cards={2} />;
  if (!scenarios.data || !locations.data || !context.data) return <main className={styles.page}><p className={styles.error}>{userFacingError(scenarios.error ?? locations.error ?? context.error)}</p></main>;

  function runComparison() {
    const targetTime = selectedDate === scenarios.data!.start
      ? context.data!.suggested_target_time
      : `${selectedDate}T09:30:00+08:00`;
    compare.mutate({ origin_id: originId, destination_id: destinationId, target_time: targetTime, preferences: { priority, max_budget: 100 }, scenario: makeScenario(preset) });
  }

  return (
    <main className={styles.page}>
      <div className={styles.intro}><span>Scenario preview</span><h1>Future scenario preview</h1><p>Select a classroom preset to compare normal and stress conditions without saving.</p></div>
      <section className={styles.card}>
        <div className={styles.form}>
          <label>Scenario date<select aria-label="Mobile scenario date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)}>{scenarios.data.scenarios.map((item) => <option value={item.date} key={item.date}>{item.date}</option>)}</select></label>
          <div><small>Stress preset</small><div className={styles.chips}>{(Object.keys(presetLabels) as PresetId[]).map((id) => <button type="button" aria-pressed={preset === id} key={id} onClick={() => setPreset(id)}>{presetLabels[id]}</button>)}</div></div>
          <label>Travel direction<select aria-label="Mobile scenario direction" value={direction} onChange={(event) => {
            const next = event.target.value as typeof direction;
            const item = locations.data!.directions.find((candidate) => candidate.id === next)!;
            setDirection(next); setOriginId(item.origin_ids[0]); setDestinationId(item.destination_ids[0]);
          }}>{locations.data.directions.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
          <div className={styles.row}>
            <label>Origin<select aria-label="Mobile scenario origin" value={originId} onChange={(event) => setOriginId(event.target.value)}>{origins.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
            <label>Destination<select aria-label="Mobile scenario destination" value={destinationId} onChange={(event) => setDestinationId(event.target.value)}>{destinations.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          </div>
          <label>Route preference<select aria-label="Mobile scenario preference" value={priority} onChange={(event) => setPriority(event.target.value as Priority)}><option value="balanced">Balanced</option><option value="fastest">Fastest</option><option value="cheapest">Lowest cost</option></select></label>
          <button className={styles.button} disabled={compare.isPending} onClick={runComparison}>{compare.isPending ? "AI is simulating…" : "Compare AI plans"}</button>
          {compare.error && <p className={styles.error}>{userFacingError(compare.error)}</p>}
        </div>
      </section>
      {compare.data && <section aria-live="polite">
        <div className={styles.resultHero}><small>Default scenario → {presetLabels[preset]}</small><h2>{compare.data.candidate.recommended} Port</h2><p>{compare.data.recommended_changed ? `Recommendation changed from ${compare.data.baseline.recommended}` : "The recommended port is unchanged, but wait and risk were recalculated."}</p></div>
        <div className={styles.list}>{compare.data.ports.map((port) => <article key={port.port_id}><header><strong>{port.port_name}</strong><b>{port.wait_delta_minutes > 0 ? "+" : ""}{port.wait_delta_minutes} min</b></header><p>Default {port.baseline_wait_minutes} minutes → Scenario {port.candidate_wait_minutes} minutes · Late-risk change {port.late_risk_delta_percent > 0 ? "+" : ""}{port.late_risk_delta_percent}%</p></article>)}</div>
        <p className={styles.message}>This preview does not save the scenario or write to forecast or audit history.</p>
      </section>}
    </main>
  );
}
