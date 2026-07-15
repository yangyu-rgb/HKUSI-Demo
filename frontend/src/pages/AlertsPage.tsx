import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { fetchLocations } from "../features/prediction/api";
import type { Priority } from "../features/prediction/types";
import {
  fetchSubscriptionEvaluations,
  fetchSubscriptionPreview,
  markSubscriptionEvaluationRead,
  fetchNotifications,
  markNotificationRead,
  runAlertCycle,
  saveSubscriptionEvaluation,
} from "../features/subscription/api";
import { useSubscriptions } from "../features/subscription/useSubscriptions";
import type { SubscriptionRecord, Weekday } from "../features/subscription/types";
import { PageSkeleton } from "../shared/components/PageSkeleton";
import { formatClock, formatHongKongDateTime } from "../shared/formatters";
import { queryKeys } from "../shared/queryKeys";
import styles from "./AlertsPage.module.css";


const USER_ID = "demo-user";
const DAYS: Array<[Weekday, string]> = [
  ["monday", "Mon"],
  ["tuesday", "Tue"],
  ["wednesday", "Wed"],
  ["thursday", "Thu"],
  ["friday", "Fri"],
  ["saturday", "Sat"],
  ["sunday", "Sun"],
];


function formatNextAlert(value: string) {
  if (/^\d{2}:\d{2}$/.test(value) || Number.isNaN(new Date(value).getTime())) {
    return value;
  }
  return formatHongKongDateTime(value);
}


export function AlertsPage() {
  const locations = useQuery({
    queryKey: queryKeys.locations,
    queryFn: fetchLocations,
    staleTime: Infinity,
  });
  const subscriptions = useSubscriptions(USER_ID);
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [originId, setOriginId] = useState("hku");
  const [destinationId, setDestinationId] = useState("nanshan-tech");
  const [arrivalDeadline, setArrivalDeadline] = useState("09:30");
  const [priority, setPriority] = useState<Priority>("balanced");
  const [days, setDays] = useState<Weekday[]>(["monday", "wednesday", "friday"]);
  const [advanceReminder, setAdvanceReminder] = useState(true);
  const [anomalyAlert, setAnomalyAlert] = useState(true);
  const [betterRouteAlert, setBetterRouteAlert] = useState(true);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const preview = useQuery({
    queryKey: queryKeys.subscriptionPreview(previewId ?? ""),
    queryFn: () => fetchSubscriptionPreview(previewId!),
    enabled: Boolean(previewId),
  });
  const evaluations = useQuery({
    queryKey: queryKeys.subscriptionEvaluations(previewId ?? ""),
    queryFn: () => fetchSubscriptionEvaluations(previewId!),
    enabled: Boolean(previewId),
  });
  const notifications = useQuery({
    queryKey: queryKeys.notifications(USER_ID),
    queryFn: () => fetchNotifications(USER_ID),
  });
  const alertCycle = useMutation({
    mutationFn: () => runAlertCycle(USER_ID),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications(USER_ID) });
      setMessage("The local alert cycle is complete. Triggered results were added to the notification inbox.");
    },
  });
  const markNotification = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications(USER_ID) }),
  });
  const saveEvaluation = useMutation({
    mutationFn: saveSubscriptionEvaluation,
    onSuccess: async () => {
      if (previewId) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.subscriptionEvaluations(previewId),
        });
      }
    },
  });
  const markRead = useMutation({
    mutationFn: markSubscriptionEvaluationRead,
    onSuccess: async () => {
      if (previewId) {
        await queryClient.invalidateQueries({
          queryKey: queryKeys.subscriptionEvaluations(previewId),
        });
      }
    },
  });

  useEffect(() => {
    if (previewId && subscriptions.subscriptions.some((item) => item.subscription_id === previewId)) {
      return;
    }
    setPreviewId(subscriptions.subscriptions[0]?.subscription_id ?? null);
  }, [previewId, subscriptions.subscriptions]);

  function resetForm() {
    setEditingId(null);
    setOriginId("hku");
    setDestinationId("nanshan-tech");
    setArrivalDeadline("09:30");
    setPriority("balanced");
    setDays(["monday", "wednesday", "friday"]);
    setAdvanceReminder(true);
    setAnomalyAlert(true);
    setBetterRouteAlert(true);
  }

  function beginEdit(item: SubscriptionRecord) {
    setEditingId(item.subscription_id);
    setOriginId(item.routine.origin_id);
    setDestinationId(item.routine.destination_id);
    setArrivalDeadline(item.routine.arrival_deadline);
    setPriority(item.routine.priority);
    setDays(item.routine.days);
    setAdvanceReminder(item.alerts.advance_reminder);
    setAnomalyAlert(item.alerts.anomaly_alert);
    setBetterRouteAlert(item.alerts.better_route_alert);
    setPreviewId(item.subscription_id);
    setMessage("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    const payload = {
      routine: {
        origin_id: originId,
        destination_id: destinationId,
        days,
        arrival_deadline: arrivalDeadline,
        priority,
      },
      alerts: {
        advance_reminder: advanceReminder,
        anomaly_alert: anomalyAlert,
        better_route_alert: betterRouteAlert,
      },
    };
    try {
      if (editingId) {
        await subscriptions.update({ subscriptionId: editingId, payload });
        setPreviewId(editingId);
        await queryClient.invalidateQueries({
          queryKey: queryKeys.subscriptionPreview(editingId),
        });
        setMessage("Subscription updated.");
      } else {
        const created = await subscriptions.create({ user_id: USER_ID, ...payload });
        setPreviewId(created.subscription_id);
        await queryClient.invalidateQueries({
          queryKey: queryKeys.subscriptionPreview(created.subscription_id),
        });
        setMessage("Subscription created.");
      }
      resetForm();
    } catch {
      // The mutation exposes the normalized API error below the form.
    }
  }

  async function handleDelete(subscriptionId: string) {
    if (window.confirm("Delete this alert subscription?")) {
      setMessage("");
      try {
        await subscriptions.remove(subscriptionId);
        if (editingId === subscriptionId) {
          resetForm();
        }
      } catch {
        // The mutation exposes the normalized API error below the form.
      }
    }
  }

  async function handleSaveEvaluation() {
    if (!previewId) {
      return;
    }
    try {
      await saveEvaluation.mutateAsync(previewId);
      setMessage("The current alert evaluation was saved to history.");
    } catch {
      setMessage("The alert evaluation could not be saved. Try again later.");
    }
  }

  if (locations.isPending || subscriptions.loading) {
    return <PageSkeleton cards={2} />;
  }

  return (
    <main className="page">
      <div className="pageIntro">
        <span className="sectionKicker">Proactive alert</span>
        <h1>Smart alert subscriptions</h1>
        <p>Create, edit, and delete cross-border commute alerts. All subscriptions are stored in local SQLite.</p>
      </div>
      <section className={styles.grid}>
        <form className={styles.form} onSubmit={(event) => void handleSubmit(event)}>
          <h2>{editingId ? "Edit subscription" : "New subscription"}</h2>
          <label>
            <span>Origin</span>
            <select required value={originId} onChange={(event) => {
              const nextOrigin = event.target.value;
              const direction = locations.data?.directions.find(
                (item) => item.origin_ids.includes(nextOrigin),
              );
              setOriginId(nextOrigin);
              setDestinationId(direction?.destination_ids[0] ?? destinationId);
            }}>
              {locations.data?.origins.map((item) => (
                <option value={item.id} key={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Destination</span>
            <select required value={destinationId} onChange={(event) => setDestinationId(event.target.value)}>
              {locations.data?.destinations.filter((item) => {
                const direction = locations.data?.directions.find(
                  (candidate) => candidate.origin_ids.includes(originId),
                );
                return direction?.destination_ids.includes(item.id);
              }).map((item) => (
                <option value={item.id} key={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <div className={styles.formRow}>
            <label>
              <span>Planned arrival</span>
              <input
                type="time"
                required
                value={arrivalDeadline}
                onChange={(event) => setArrivalDeadline(event.target.value)}
              />
            </label>
            <label>
              <span>Route preference</span>
              <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
                <option value="balanced">Balanced</option>
                <option value="fastest">Fastest</option>
                <option value="cheapest">Lowest cost</option>
              </select>
            </label>
          </div>
          <fieldset className={styles.days}>
            <legend>Commute days</legend>
            {DAYS.map(([value, label]) => (
              <label key={value}>
                <input
                  type="checkbox"
                  checked={days.includes(value)}
                  onChange={(event) => setDays(
                    event.target.checked
                      ? [...days, value]
                      : days.filter((day) => day !== value),
                  )}
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
          <div className={styles.alertOptions}>
            <label><input type="checkbox" checked={advanceReminder} onChange={(event) => setAdvanceReminder(event.target.checked)} /> 30 minutes before departure</label>
            <label><input type="checkbox" checked={anomalyAlert} onChange={(event) => setAnomalyAlert(event.target.checked)} /> Abnormal congestion</label>
            <label><input type="checkbox" checked={betterRouteAlert} onChange={(event) => setBetterRouteAlert(event.target.checked)} /> Better route available</label>
          </div>
          <div className={styles.actions}>
            <button className="button buttonLight" disabled={subscriptions.saving || days.length === 0}>
              {subscriptions.saving ? "Saving…" : editingId ? "Save changes" : "Create alert"}
            </button>
            {editingId && (
              <button type="button" className={styles.cancel} onClick={resetForm}>Cancel</button>
            )}
          </div>
          {message && <p className={styles.success}>{message}</p>}
          {subscriptions.error && <p className={styles.error}>{subscriptions.error}</p>}
        </form>

        <div className={styles.sideColumn}>
          <div className={styles.list}>
            <div className={styles.listHeading}>
              <h2>Existing subscriptions</h2>
              <span>{subscriptions.subscriptions.length} total</span>
            </div>
            {subscriptions.subscriptions.map((item) => {
            const origin = locations.data?.origins.find((entry) => entry.id === item.routine.origin_id);
            const destination = locations.data?.destinations.find((entry) => entry.id === item.routine.destination_id);
            return (
              <article className={styles.subscription} key={item.subscription_id}>
                <div>
                  <strong>{origin?.name} → {destination?.name}</strong>
                  <span>{item.routine.days.length} days/week · Arrive by {item.routine.arrival_deadline}</span>
                </div>
                  <b>Next alert: {item.next_alert ? formatNextAlert(item.next_alert) : "Disabled"}</b>
                  <div className={styles.itemActions}>
                  <button onClick={() => setPreviewId(item.subscription_id)}>Preview</button>
                  <button onClick={() => beginEdit(item)}>Edit</button>
                  <button onClick={() => void handleDelete(item.subscription_id)} disabled={subscriptions.deleting}>Delete</button>
                </div>
              </article>
            );
            })}
          </div>
          <section className={styles.preview}>
            <div className={styles.previewHeading}>
              <div><span className="sectionKicker">Next commute</span><h2>Alert preview</h2></div>
              {preview.data && <b>{preview.data.recommended_port} Port</b>}
            </div>
            {!previewId && <p>Create or select a subscription to preview the next alert.</p>}
            {preview.isPending && <p>Evaluating the next commute…</p>}
            {preview.error && <p className={styles.previewError}>The alert preview is temporarily unavailable.</p>}
            {preview.data && (
              <>
                <p className={styles.previewMeta}>Planned arrival by {formatHongKongDateTime(preview.data.target_time)}; recommended departure no later than {formatClock(preview.data.latest_departure)}.</p>
                <button
                  type="button"
                  className={styles.saveEvaluation}
                  onClick={() => void handleSaveEvaluation()}
                  disabled={saveEvaluation.isPending}
                >
                  {saveEvaluation.isPending ? "Saving…" : "Save this evaluation"}
                </button>
                <div className={styles.previewCards}>
                  {preview.data.alerts.map((alert) => (
                    <article className={alert.triggered ? styles.previewActive : styles.previewInactive} key={alert.kind}>
                      <div><strong>{alert.title}</strong><span>{alert.triggered ? "Will send" : alert.enabled ? "Not triggered" : "Disabled"}</span></div>
                      <p>{alert.message}</p>
                      {alert.scheduled_at && <small>Evaluate/send time: {formatHongKongDateTime(alert.scheduled_at)}</small>}
                    </article>
                  ))}
                </div>
                {preview.data.alternative_port && <p className={styles.alternative}>Alternative port: {preview.data.alternative_port}</p>}
              </>
            )}
            {previewId && (
              <div className={styles.history}>
                <div className={styles.historyHeading}>
                  <strong>Evaluation history</strong>
                  <span>{evaluations.data?.unread_total ?? 0} unread</span>
                </div>
                {evaluations.isPending && <p>Loading history…</p>}
                {!evaluations.isPending && evaluations.data?.evaluations.length === 0 && (
                  <p>No saved evaluations. Previewing alone does not write to history.</p>
                )}
                {evaluations.data?.evaluations.map((evaluation) => (
                  <article
                    className={evaluation.is_read ? styles.historyRead : styles.historyUnread}
                    key={evaluation.evaluation_id}
                  >
                    <div>
                      <strong>{evaluation.recommended_port} Port</strong>
                      <span>{formatHongKongDateTime(evaluation.evaluated_at)} · Depart by {formatClock(evaluation.latest_departure)}</span>
                    </div>
                    {!evaluation.is_read && (
                      <button
                        type="button"
                        onClick={() => void markRead.mutateAsync(evaluation.evaluation_id)}
                        disabled={markRead.isPending}
                      >Mark as read</button>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </section>
      <section className={styles.preview}>
        <div className={styles.previewHeading}>
          <div><span className="sectionKicker">Local delivery adapter</span><h2>Notification inbox</h2></div>
          <button
            type="button"
            className={styles.saveEvaluation}
            disabled={alertCycle.isPending}
            onClick={() => alertCycle.mutate()}
          >
            {alertCycle.isPending ? "Running…" : "Run local alert cycle"}
          </button>
        </div>
        <p>This simulates email, SMS, or push delivery boundaries without connecting to external services.</p>
        {notifications.data?.notifications.length === 0 && <p>No notifications.</p>}
        <div className={styles.history}>
          {notifications.data?.notifications.map((notification) => (
            <article
              className={notification.is_read ? styles.historyRead : styles.historyUnread}
              key={notification.id}
            >
              <div>
                <strong>{notification.title}</strong>
                <span>{notification.message} · {formatHongKongDateTime(notification.scheduled_at)}</span>
              </div>
              {!notification.is_read && (
                <button onClick={() => markNotification.mutate(notification.id)}>Mark as read</button>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
