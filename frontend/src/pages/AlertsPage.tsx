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
  ["monday", "周一"],
  ["tuesday", "周二"],
  ["wednesday", "周三"],
  ["thursday", "周四"],
  ["friday", "周五"],
  ["saturday", "周六"],
  ["sunday", "周日"],
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
      setMessage("本地告警周期已完成，触发结果已写入通知收件箱。");
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
        setMessage("订阅已更新。");
      } else {
        const created = await subscriptions.create({ user_id: USER_ID, ...payload });
        setPreviewId(created.subscription_id);
        await queryClient.invalidateQueries({
          queryKey: queryKeys.subscriptionPreview(created.subscription_id),
        });
        setMessage("订阅已创建。");
      }
      resetForm();
    } catch {
      // The mutation exposes the normalized API error below the form.
    }
  }

  async function handleDelete(subscriptionId: string) {
    if (window.confirm("确定删除这条提醒订阅？")) {
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
      setMessage("当前提醒评估已保存到历史记录。");
    } catch {
      setMessage("提醒评估暂时无法保存，请稍后重试。");
    }
  }

  if (locations.isPending || subscriptions.loading) {
    return <PageSkeleton cards={2} />;
  }

  return (
    <main className="page">
      <div className="pageIntro">
        <span className="sectionKicker">Proactive alert</span>
        <h1>智能提醒订阅管理</h1>
        <p>创建、编辑和删除跨境通勤提醒；所有订阅保存在本地 SQLite 中。</p>
      </div>
      <section className={styles.grid}>
        <form className={styles.form} onSubmit={(event) => void handleSubmit(event)}>
          <h2>{editingId ? "编辑订阅" : "新增订阅"}</h2>
          <label>
            <span>出发地</span>
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
            <span>目的地</span>
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
              <span>计划到达</span>
              <input
                type="time"
                required
                value={arrivalDeadline}
                onChange={(event) => setArrivalDeadline(event.target.value)}
              />
            </label>
            <label>
              <span>路线偏好</span>
              <select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
                <option value="balanced">稳妥均衡</option>
                <option value="fastest">时间最快</option>
                <option value="cheapest">费用最低</option>
              </select>
            </label>
          </div>
          <fieldset className={styles.days}>
            <legend>通勤日期</legend>
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
            <label><input type="checkbox" checked={advanceReminder} onChange={(event) => setAdvanceReminder(event.target.checked)} /> 出发前30分钟</label>
            <label><input type="checkbox" checked={anomalyAlert} onChange={(event) => setAnomalyAlert(event.target.checked)} /> 异常拥堵</label>
            <label><input type="checkbox" checked={betterRouteAlert} onChange={(event) => setBetterRouteAlert(event.target.checked)} /> 更优路线</label>
          </div>
          <div className={styles.actions}>
            <button className="button buttonLight" disabled={subscriptions.saving || days.length === 0}>
              {subscriptions.saving ? "保存中…" : editingId ? "保存修改" : "创建提醒"}
            </button>
            {editingId && (
              <button type="button" className={styles.cancel} onClick={resetForm}>取消</button>
            )}
          </div>
          {message && <p className={styles.success}>{message}</p>}
          {subscriptions.error && <p className={styles.error}>{subscriptions.error}</p>}
        </form>

        <div className={styles.sideColumn}>
          <div className={styles.list}>
            <div className={styles.listHeading}>
              <h2>已有订阅</h2>
              <span>{subscriptions.subscriptions.length} 条</span>
            </div>
            {subscriptions.subscriptions.map((item) => {
            const origin = locations.data?.origins.find((entry) => entry.id === item.routine.origin_id);
            const destination = locations.data?.destinations.find((entry) => entry.id === item.routine.destination_id);
            return (
              <article className={styles.subscription} key={item.subscription_id}>
                <div>
                  <strong>{origin?.name} → {destination?.name}</strong>
                  <span>{item.routine.days.length}天/周 · {item.routine.arrival_deadline}前到达</span>
                </div>
                  <b>下次提醒约 {item.next_alert ? formatNextAlert(item.next_alert) : "已关闭"}</b>
                  <div className={styles.itemActions}>
                  <button onClick={() => setPreviewId(item.subscription_id)}>预览</button>
                  <button onClick={() => beginEdit(item)}>编辑</button>
                  <button onClick={() => void handleDelete(item.subscription_id)} disabled={subscriptions.deleting}>删除</button>
                </div>
              </article>
            );
            })}
          </div>
          <section className={styles.preview}>
            <div className={styles.previewHeading}>
              <div><span className="sectionKicker">Next commute</span><h2>提醒预览</h2></div>
              {preview.data && <b>{preview.data.recommended_port}口岸</b>}
            </div>
            {!previewId && <p>创建或选择一条订阅以查看下一次提醒。</p>}
            {preview.isPending && <p>正在评估下一次通勤…</p>}
            {preview.error && <p className={styles.previewError}>暂时无法生成提醒预览。</p>}
            {preview.data && (
              <>
                <p className={styles.previewMeta}>计划于 {formatHongKongDateTime(preview.data.target_time)} 前到达；最晚建议 {formatClock(preview.data.latest_departure)} 出发。</p>
                <button
                  type="button"
                  className={styles.saveEvaluation}
                  onClick={() => void handleSaveEvaluation()}
                  disabled={saveEvaluation.isPending}
                >
                  {saveEvaluation.isPending ? "正在保存…" : "保存本次评估"}
                </button>
                <div className={styles.previewCards}>
                  {preview.data.alerts.map((alert) => (
                    <article className={alert.triggered ? styles.previewActive : styles.previewInactive} key={alert.kind}>
                      <div><strong>{alert.title}</strong><span>{alert.triggered ? "将发送" : alert.enabled ? "当前未触发" : "未启用"}</span></div>
                      <p>{alert.message}</p>
                      {alert.scheduled_at && <small>评估/发送时间：{formatHongKongDateTime(alert.scheduled_at)}</small>}
                    </article>
                  ))}
                </div>
                {preview.data.alternative_port && <p className={styles.alternative}>备用口岸：{preview.data.alternative_port}</p>}
              </>
            )}
            {previewId && (
              <div className={styles.history}>
                <div className={styles.historyHeading}>
                  <strong>评估历史</strong>
                  <span>{evaluations.data?.unread_total ?? 0} 条未读</span>
                </div>
                {evaluations.isPending && <p>正在读取历史记录…</p>}
                {!evaluations.isPending && evaluations.data?.evaluations.length === 0 && (
                  <p>暂无已保存评估；预览本身不会写入历史。</p>
                )}
                {evaluations.data?.evaluations.map((evaluation) => (
                  <article
                    className={evaluation.is_read ? styles.historyRead : styles.historyUnread}
                    key={evaluation.evaluation_id}
                  >
                    <div>
                      <strong>{evaluation.recommended_port}口岸</strong>
                      <span>{formatHongKongDateTime(evaluation.evaluated_at)} · 最晚 {formatClock(evaluation.latest_departure)} 出发</span>
                    </div>
                    {!evaluation.is_read && (
                      <button
                        type="button"
                        onClick={() => void markRead.mutateAsync(evaluation.evaluation_id)}
                        disabled={markRead.isPending}
                      >标为已读</button>
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
          <div><span className="sectionKicker">Local delivery adapter</span><h2>通知收件箱</h2></div>
          <button
            type="button"
            className={styles.saveEvaluation}
            disabled={alertCycle.isPending}
            onClick={() => alertCycle.mutate()}
          >
            {alertCycle.isPending ? "运行中…" : "运行本地告警周期"}
          </button>
        </div>
        <p>此处模拟邮件、短信或推送的投递边界，不会连接外部服务。</p>
        {notifications.data?.notifications.length === 0 && <p>暂无通知。</p>}
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
                <button onClick={() => markNotification.mutate(notification.id)}>标为已读</button>
              )}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
