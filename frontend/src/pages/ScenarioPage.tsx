import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { ScenarioDay, ScenarioWrite } from "../features/scenario/api";
import { useScenarios } from "../features/scenario/useScenarios";
import { useDemoContext } from "../features/demo/useDemo";
import { fetchLocations } from "../features/prediction/api";
import type { PredictionQueryInput, Priority } from "../features/prediction/types";
import { getDemoPersonaId, userFacingError } from "../shared/api/client";
import { ErrorState } from "../shared/components/PageState";
import { PageSkeleton } from "../shared/components/PageSkeleton";
import { queryKeys } from "../shared/queryKeys";
import styles from "./ScenarioPage.module.css";


const weatherLabels: Record<string, string> = { clear: "Clear", rain: "Rain", heavy_rain: "Heavy rain", thunderstorm: "Thunderstorm" };
const ports = ["罗湖", "福田", "皇岗", "深圳湾"];
const portLabels: Record<string, string> = { 罗湖: "Lo Wu", 福田: "Futian", 皇岗: "Huanggang", 深圳湾: "Shenzhen Bay" };


function editable(day: ScenarioDay): ScenarioWrite {
  return { weather: day.weather, is_holiday: day.is_holiday, events: day.events.map((event) => ({ ...event })) };
}


export function ScenarioPage() {
  const { scenarios, save, restore, reset, compare } = useScenarios();
  const context = useDemoContext();
  const locations = useQuery({ queryKey: queryKeys.locations, queryFn: fetchLocations, staleTime: Infinity });
  const [selectedDate, setSelectedDate] = useState("");
  const [draft, setDraft] = useState<ScenarioWrite | null>(null);
  const [preset, setPreset] = useState("commuter_peak");
  const [comparisonQuery, setComparisonQuery] = useState<PredictionQueryInput>({
    direction: "hong_kong_to_shenzhen",
    origin_id: "hku",
    destination_id: "nanshan-tech",
    target_time: "",
    priority: "balanced",
    max_budget: 100,
  });
  const selected = useMemo(() => scenarios.data?.scenarios.find((item) => item.date === selectedDate), [scenarios.data, selectedDate]);

  useEffect(() => {
    const first = scenarios.data?.scenarios[0];
    if (!first || selectedDate) return;
    setSelectedDate(first.date);
    setDraft(editable(first));
  }, [scenarios.data, selectedDate]);
  useEffect(() => { if (selected) setDraft(editable(selected)); }, [selected]);
  useEffect(() => { compare.reset(); }, [draft]);
  useEffect(() => {
    if (!selectedDate || !scenarios.data || !context.data) return;
    setComparisonQuery((current) => ({
      ...current,
      target_time: selectedDate === scenarios.data!.start
        ? context.data!.suggested_target_time.slice(0, 16)
        : `${selectedDate}T09:30`,
    }));
  }, [selectedDate, scenarios.data, context.data]);

  if (scenarios.isPending || locations.isPending || context.isPending) return <PageSkeleton cards={3} />;
  if (!scenarios.data || !draft || !selected || !locations.data || !context.data) return <ErrorState title="Unable to load the Scenario Lab" detail={userFacingError(scenarios.error ?? locations.error ?? context.error)} />;
  const operator = getDemoPersonaId() === "demo-user";
  const busy = save.isPending || restore.isPending || reset.isPending;
  const mutationError = save.error ?? restore.error ?? reset.error;
  const selectedDirection = locations.data.directions.find((item) => item.id === comparisonQuery.direction) ?? locations.data.directions[0];
  const comparisonOrigins = locations.data.origins.filter((item) => selectedDirection.origin_ids.includes(item.id));
  const comparisonDestinations = locations.data.destinations.filter((item) => selectedDirection.destination_ids.includes(item.id));

  function addPreset() {
    const item = scenarios.data!.event_presets.find((candidate) => candidate.id === preset)!;
    setDraft({ ...draft!, events: [...draft!.events, { name: String(item.name), preset, direction: null, affected_ports: [...ports], start_time: String(item.start_time), end_time: String(item.end_time), impact: item.impact as "low" | "medium" | "high" }] });
  }

  function applyClassroomPreset() {
    setDraft({
      weather: "heavy_rain",
      is_holiday: true,
      events: [{
        name: "Major Shenzhen Bay event",
        preset: "classroom_demo",
        direction: "hong_kong_to_shenzhen",
        affected_ports: ["深圳湾"],
        start_time: "00:00",
        end_time: "23:59",
        impact: "high",
      }],
    });
    setComparisonQuery((current) => ({
      ...current,
      direction: "hong_kong_to_shenzhen",
      origin_id: "hku",
      destination_id: "nanshan-tech",
      priority: "balanced",
      max_budget: 100,
    }));
  }

  function runComparison() {
    compare.mutate({
      origin_id: comparisonQuery.origin_id,
      destination_id: comparisonQuery.destination_id,
      target_time: comparisonQuery.target_time,
      preferences: {
        priority: comparisonQuery.priority,
        max_budget: comparisonQuery.max_budget,
      },
      scenario: draft!,
    });
  }

  return (
    <main className="page">
      <section className={styles.hero}>
        <div><span className="sectionKicker">AI scenario lab</span><h1>Future Scenario Lab</h1><p>Adjust weather, holidays, and port events for the next 14 days, then let AI V2 generate alternative route plans.</p></div>
        <button className="button" disabled={!operator || busy} onClick={() => reset.mutate()}>Reset all scenarios</button>
      </section>
      {!operator && <p className={styles.notice}>Switch to the Demo Operator persona to edit scenarios. Other personas have read-only access.</p>}
      <section className={styles.calendar}>
        {scenarios.data.scenarios.map((day) => (
          <button key={day.date} className={day.date === selectedDate ? styles.selectedDay : styles.day} onClick={() => setSelectedDate(day.date)}>
            <strong>{day.date.slice(5)}</strong><span>{weatherLabels[day.weather]}</span><small>{day.events.length ? `${day.events.length} events` : "Default scenario"}{day.is_override ? " · Modified" : ""}</small>
          </button>
        ))}
      </section>
      <section className={styles.editor}>
        <div className={styles.editorHeading}><div><span className="sectionKicker">Selected day</span><h2>{selected.date} scenario</h2></div><Link className="button buttonPrimary" to={selected.date === scenarios.data.start ? "/planner" : `/planner?target_time=${selected.date}T09:00`}>Plan with this scenario</Link></div>
        <div className={styles.baseFields}>
          <label><span>Weather</span><select aria-label="Scenario weather" disabled={!operator} value={draft.weather} onChange={(event) => setDraft({ ...draft, weather: event.target.value as ScenarioWrite["weather"] })}>{scenarios.data.weather_options.map((weather) => <option key={weather} value={weather}>{weatherLabels[weather]}</option>)}</select></label>
          <label className={styles.checkbox}><input disabled={!operator} type="checkbox" checked={draft.is_holiday} onChange={(event) => setDraft({ ...draft, is_holiday: event.target.checked })} />Holiday passenger flow</label>
          <label><span>Event preset</span><select aria-label="Event preset" disabled={!operator} value={preset} onChange={(event) => setPreset(event.target.value)}>{scenarios.data.event_presets.map((item) => <option key={String(item.id)} value={String(item.id)}>{String(item.name)}</option>)}</select></label>
          <button className="button" disabled={!operator || draft.events.length >= 8} onClick={addPreset}>Add event</button>
        </div>
        <div className={styles.events}>
          {draft.events.length === 0 && <p className={styles.empty}>No custom events for this day.</p>}
          {draft.events.map((item, index) => (
            <article className={styles.eventCard} key={`${item.name}-${index}`}>
              <input aria-label="Event name" disabled={!operator} value={item.name} onChange={(event) => setDraft({ ...draft, events: draft.events.map((current, i) => i === index ? { ...current, name: event.target.value } : current) })} />
              <select aria-label="Event direction" disabled={!operator} value={item.direction ?? ""} onChange={(event) => setDraft({ ...draft, events: draft.events.map((current, i) => i === index ? { ...current, direction: (event.target.value || null) as typeof current.direction } : current) })}><option value="">Both directions</option><option value="hong_kong_to_shenzhen">Hong Kong → Shenzhen</option><option value="shenzhen_to_hong_kong">Shenzhen → Hong Kong</option></select>
              <input aria-label="Start time" disabled={!operator} type="time" value={item.start_time} onChange={(event) => setDraft({ ...draft, events: draft.events.map((current, i) => i === index ? { ...current, start_time: event.target.value } : current) })} />
              <input aria-label="End time" disabled={!operator} type="time" value={item.end_time} onChange={(event) => setDraft({ ...draft, events: draft.events.map((current, i) => i === index ? { ...current, end_time: event.target.value } : current) })} />
              <select aria-label="Impact level" disabled={!operator} value={item.impact} onChange={(event) => setDraft({ ...draft, events: draft.events.map((current, i) => i === index ? { ...current, impact: event.target.value as typeof current.impact } : current) })}><option value="low">Low impact</option><option value="medium">Medium impact</option><option value="high">High impact</option></select>
              <div className={styles.portChecks}>{ports.map((port) => <label key={port}><input disabled={!operator} type="checkbox" checked={item.affected_ports.includes(port)} onChange={(event) => setDraft({ ...draft, events: draft.events.map((current, i) => i === index ? { ...current, affected_ports: event.target.checked ? [...current.affected_ports, port] : current.affected_ports.filter((value) => value !== port) } : current) })} />{portLabels[port]}</label>)}</div>
              <button className="button" disabled={!operator} onClick={() => setDraft({ ...draft, events: draft.events.filter((_, i) => i !== index) })}>Delete</button>
            </article>
          ))}
        </div>
        {mutationError && <p className="formError">{userFacingError(mutationError)}</p>}
        <div className={styles.actions}><button className="button buttonPrimary" disabled={!operator || busy} onClick={() => save.mutate({ date: selected.date, payload: draft })}>Save scenario</button><button className="button" disabled={!operator || busy} onClick={() => restore.mutate(selected.date)}>Restore day default</button></div>
      </section>
      <section className={styles.comparison}>
        <div className={styles.editorHeading}>
          <div><span className="sectionKicker">AI A/B comparison</span><h2>Default scenario vs current draft</h2><p>Compare without saving. The preview does not write to forecast history or audit records.</p></div>
          <button className="button" disabled={!operator} onClick={applyClassroomPreset}>Apply classroom Demo</button>
        </div>
        <div className={styles.compareFields}>
          <label><span>Direction</span><select aria-label="Comparison direction" value={comparisonQuery.direction} onChange={(event) => {
            const direction = locations.data!.directions.find((item) => item.id === event.target.value) ?? locations.data!.directions[0];
            setComparisonQuery({ ...comparisonQuery, direction: direction.id, origin_id: direction.origin_ids[0], destination_id: direction.destination_ids[0] });
          }}>{locations.data.directions.map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select></label>
          <label><span>Origin</span><select aria-label="Comparison origin" value={comparisonQuery.origin_id} onChange={(event) => setComparisonQuery({ ...comparisonQuery, origin_id: event.target.value })}>{comparisonOrigins.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          <label><span>Destination</span><select aria-label="Comparison destination" value={comparisonQuery.destination_id} onChange={(event) => setComparisonQuery({ ...comparisonQuery, destination_id: event.target.value })}>{comparisonDestinations.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          <label><span>Arrival time</span><input aria-label="Comparison arrival time" type="datetime-local" min={context.data.min_target_time.slice(0, 16)} max={context.data.max_target_time.slice(0, 16)} value={comparisonQuery.target_time} onChange={(event) => setComparisonQuery({ ...comparisonQuery, target_time: event.target.value })} /></label>
          <label><span>Preference</span><select aria-label="Comparison preference" value={comparisonQuery.priority} onChange={(event) => setComparisonQuery({ ...comparisonQuery, priority: event.target.value as Priority })}><option value="balanced">Balanced</option><option value="fastest">Fastest</option><option value="cheapest">Lowest cost</option></select></label>
          <label><span>Budget</span><input aria-label="Comparison budget" type="number" min="0" value={comparisonQuery.max_budget ?? ""} onChange={(event) => setComparisonQuery({ ...comparisonQuery, max_budget: event.target.value === "" ? null : Number(event.target.value) })} /></label>
          <button className="button buttonPrimary" disabled={!operator || compare.isPending || !comparisonQuery.target_time} onClick={runComparison}>{compare.isPending ? "Comparing…" : "Compare AI plans"}</button>
        </div>
        {compare.error && <p className="formError">{userFacingError(compare.error)}</p>}
        {compare.data && (
          <div className={styles.compareResults}>
            <div className={styles.recommendationChange}>
              <div><span>Default scenario</span><strong>{compare.data.baseline.recommended} Port</strong></div>
              <b>{compare.data.recommended_changed ? "Recommendation changed →" : "Recommendation unchanged →"}</b>
              <div><span>Current draft</span><strong>{compare.data.candidate.recommended} Port</strong></div>
            </div>
            <p className={styles.compareReason}>{compare.data.candidate.reason}</p>
            <div className={styles.portComparison}>
              {compare.data.ports.map((port) => (
                <article key={port.port_id}>
                  <h3>{port.port_name}</h3>
                  <div><span>Default</span><strong>{port.baseline_wait_minutes} min</strong></div>
                  <div><span>Draft</span><strong>{port.candidate_wait_minutes} min</strong></div>
                  <em className={port.wait_delta_minutes > 0 ? styles.increase : styles.decrease}>{port.wait_delta_minutes > 0 ? "+" : ""}{port.wait_delta_minutes} min · Risk {port.late_risk_delta_percent > 0 ? "+" : ""}{port.late_risk_delta_percent}%</em>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
