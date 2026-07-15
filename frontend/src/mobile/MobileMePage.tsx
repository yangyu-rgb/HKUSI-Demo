import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { useV2Model } from "../features/demo/useDemo";
import { fetchLocations } from "../features/prediction/api";
import type { Priority } from "../features/prediction/types";
import { fetchNotifications, fetchSubscriptionPreview, markNotificationRead, runAlertCycle } from "../features/subscription/api";
import type { SubscriptionRecord, Weekday } from "../features/subscription/types";
import { useSubscriptions } from "../features/subscription/useSubscriptions";
import { clearDemoSession, getDemoPersonaId, userFacingError } from "../shared/api/client";
import { PageSkeleton } from "../shared/components/PageSkeleton";
import { formatClock, formatHongKongDateTime } from "../shared/formatters";
import { queryKeys } from "../shared/queryKeys";
import styles from "./MobilePages.module.css";


const days: Array<[Weekday, string]> = [["monday","M"],["tuesday","T"],["wednesday","W"],["thursday","T"],["friday","F"],["saturday","S"],["sunday","S"]];
type Tab = "alerts" | "notifications" | "model";


export function MobileMePage() {
  const userId = getDemoPersonaId();
  const client = useQueryClient();
  const locations = useQuery({ queryKey: queryKeys.locations, queryFn: fetchLocations, staleTime: Infinity });
  const subscriptions = useSubscriptions(userId);
  const model = useV2Model();
  const notifications = useQuery({ queryKey: queryKeys.notifications(userId), queryFn: () => fetchNotifications(userId) });
  const [tab, setTab] = useState<Tab>("alerts");
  const [editing, setEditing] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [originId, setOriginId] = useState("hku");
  const [destinationId, setDestinationId] = useState("nanshan-tech");
  const [arrival, setArrival] = useState("09:30");
  const [priority, setPriority] = useState<Priority>("balanced");
  const [selectedDays, setSelectedDays] = useState<Weekday[]>(["monday","wednesday","friday"]);
  const preview = useQuery({ queryKey: queryKeys.subscriptionPreview(selected ?? ""), queryFn: () => fetchSubscriptionPreview(selected!), enabled: Boolean(selected) });
  const cycle = useMutation({ mutationFn: () => runAlertCycle(userId), onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.notifications(userId) }) });
  const read = useMutation({ mutationFn: markNotificationRead, onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.notifications(userId) }) });
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!selected && subscriptions.subscriptions[0]) setSelected(subscriptions.subscriptions[0].subscription_id);
  }, [selected, subscriptions.subscriptions]);

  const direction = locations.data?.directions.find((item) => item.origin_ids.includes(originId));
  const destinations = locations.data?.destinations.filter((item) => direction?.destination_ids.includes(item.id)) ?? [];

  function resetForm() { setEditing(null); setOriginId("hku"); setDestinationId("nanshan-tech"); setArrival("09:30"); setPriority("balanced"); setSelectedDays(["monday","wednesday","friday"]); }
  function edit(item: SubscriptionRecord) { setEditing(item.subscription_id); setSelected(item.subscription_id); setOriginId(item.routine.origin_id); setDestinationId(item.routine.destination_id); setArrival(item.routine.arrival_deadline); setPriority(item.routine.priority); setSelectedDays(item.routine.days); setMessage(""); }
  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage("");
    const payload = { routine: { origin_id: originId, destination_id: destinationId, days: selectedDays, arrival_deadline: arrival, priority }, alerts: { advance_reminder: true, anomaly_alert: true, better_route_alert: true } };
    try {
      if (editing) { await subscriptions.update({ subscriptionId: editing, payload }); setSelected(editing); setMessage("Alert updated."); }
      else { const created = await subscriptions.create({ user_id: userId, ...payload }); setSelected(created.subscription_id); setMessage("Alert created."); }
      resetForm();
    } catch { /* Normalized hook error is rendered below. */ }
  }

  if (locations.isPending || subscriptions.loading || notifications.isPending || model.isPending) return <PageSkeleton cards={2} />;
  const metrics = model.data?.metrics as Record<string, { mae?: number; improvement_percent?: number }> | undefined;
  const interval = model.data?.interval_calibration as { test_coverage_percent?: number } | undefined;
  function logout() {
    clearDemoSession();
    client.clear();
    window.location.assign("/mobile/login");
  }

  return (
    <main className={styles.page}>
      <div className={styles.intro}><span>Personal commute</span><h1>My cross-border commute</h1><p>Manage alerts, review local notifications, and understand the current AI model.</p><button className={styles.logout} onClick={logout}>Sign out</button></div>
      <div className={styles.tabs} role="tablist" aria-label="My commute sections">
        {([['alerts','Alerts'],['notifications',`Notifications ${notifications.data?.unread_total || ''}`],['model','Model']] as Array<[Tab,string]>).map(([id,label]) => <button role="tab" aria-selected={tab === id} key={id} onClick={() => setTab(id)}>{label}</button>)}
      </div>

      {tab === "alerts" && <>
        <section className={styles.card}><h2>{editing ? "Edit alert" : "New alert"}</h2><form className={styles.form} onSubmit={submit}>
          <label>Origin<select aria-label="Mobile alert origin" value={originId} onChange={(event) => { const next = event.target.value; const nextDirection = locations.data?.directions.find((item) => item.origin_ids.includes(next)); setOriginId(next); setDestinationId(nextDirection?.destination_ids[0] ?? destinationId); }}>{locations.data?.origins.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          <label>Destination<select aria-label="Mobile alert destination" value={destinationId} onChange={(event) => setDestinationId(event.target.value)}>{destinations.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
          <div className={styles.row}><label>Planned arrival<input aria-label="Mobile alert arrival time" type="time" required value={arrival} onChange={(event) => setArrival(event.target.value)} /></label><label>Route preference<select aria-label="Mobile alert route preference" value={priority} onChange={(event) => setPriority(event.target.value as Priority)}><option value="balanced">Balanced</option><option value="fastest">Fastest</option><option value="cheapest">Lowest cost</option></select></label></div>
          <div><small>Commute days</small><div className={styles.checkGrid}>{days.map(([value,label]) => <label key={value}><input type="checkbox" checked={selectedDays.includes(value)} onChange={(event) => setSelectedDays(event.target.checked ? [...selectedDays,value] : selectedDays.filter((day) => day !== value))} />{label}</label>)}</div></div>
          <button className={styles.button} disabled={subscriptions.saving || selectedDays.length === 0}>{subscriptions.saving ? "Saving…" : editing ? "Save changes" : "Create alert"}</button>
          {editing && <button type="button" className={`${styles.button} ${styles.secondary}`} onClick={resetForm}>Cancel editing</button>}
          {message && <p className={styles.message}>{message}</p>}{subscriptions.error && <p className={styles.error}>{subscriptions.error}</p>}
        </form></section>
        <section className={styles.card}><h2>Existing alerts</h2><div className={styles.list}>{subscriptions.subscriptions.length === 0 && <p className={styles.empty}>No alerts yet. Create a commute plan first.</p>}{subscriptions.subscriptions.map((item) => {
          const origin = locations.data?.origins.find((entry) => entry.id === item.routine.origin_id)?.name;
          const destination = locations.data?.destinations.find((entry) => entry.id === item.routine.destination_id)?.name;
          return <article key={item.subscription_id}><header><strong>{origin} → {destination}</strong><b>{item.routine.arrival_deadline}</b></header><p>{item.routine.days.length} days/week · {item.next_alert ? `Next ${formatHongKongDateTime(item.next_alert)}` : "Alert disabled"}</p><div className={styles.actions}><button className={styles.secondary} onClick={() => setSelected(item.subscription_id)}>Preview</button><button className={styles.secondary} onClick={() => edit(item)}>Edit</button><button className={styles.danger} onClick={() => { if (window.confirm("Delete this alert?")) void subscriptions.remove(item.subscription_id); }}>Delete</button></div></article>;
        })}</div></section>
        {selected && <section className={styles.card}><h2>Next commute</h2>{preview.isPending && <p className={styles.empty}>Calculating alert…</p>}{preview.error && <p className={styles.error}>{userFacingError(preview.error)}</p>}{preview.data && <div className={styles.resultHero}><small>{preview.data.commute_date}</small><h2>{preview.data.recommended_port} Port</h2><p>Depart by {formatClock(preview.data.latest_departure)}{preview.data.alternative_port ? `; alternative: ${preview.data.alternative_port} Port` : ""}.</p></div>}</section>}
      </>}

      {tab === "notifications" && <section className={styles.card}><h2>Local notifications</h2><button className={styles.button} disabled={cycle.isPending} onClick={() => cycle.mutate()}>{cycle.isPending ? "Evaluating…" : "Run local alert cycle"}</button>{cycle.data && <p className={styles.message}>Evaluated {cycle.data.evaluated_subscriptions} alerts and created {cycle.data.created_notifications} notifications.</p>}<div className={styles.list}>{notifications.data?.notifications.length === 0 && <p className={styles.empty}>No notifications yet.</p>}{notifications.data?.notifications.map((item) => <article key={item.id}><header><strong>{item.title}</strong><b>{item.is_read ? "Read" : "Unread"}</b></header><p>{item.message}</p>{!item.is_read && <div className={styles.actions}><button className={styles.secondary} onClick={() => read.mutate(item.id)}>Mark as read</button></div>}</article>)}</div></section>}

      {tab === "model" && <><section className={styles.resultHero}><small>AI v2.2 · public-data hybrid classroom Demo</small><h2>{model.data?.artifact_available ? "Primary forecast enabled" : "Statistical fallback"}</h2><p>Hong Kong official passenger flow provides baseline features; Shenzhen official snapshots only cross-check the interval.</p><div className={styles.metrics}><div><strong>{metrics?.test?.mae ?? 1.1368}</strong><span>Test MAE</span></div><div><strong>{interval?.test_coverage_percent ?? 90.44}%</strong><span>Interval coverage</span></div><div><strong>45%</strong><span>High-consensus cap</span></div></div></section><section className={styles.card}><h2>How wait time is calculated</h2><div className={styles.list}><article><strong>1. AI learns the baseline wait</strong><p>Port, direction, time, and Hong Kong official passenger pressure generate the baseline.</p></article><article><strong>2. Scenarios are calibrated transparently</strong><p>Weather, holidays, events, official status, and fresh crowd reports adjust the result.</p></article><article><strong>3. Shenzhen snapshots validate the interval</strong><p>Greater pressure disagreement makes the range more conservative without double-counting passengers.</p></article></div><p className={styles.message}>All minute values are classroom Demo estimates, not live measurements or production accuracy claims.</p></section></>}
    </main>
  );
}
