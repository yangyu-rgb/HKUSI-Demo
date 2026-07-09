import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { fetchLocations } from "../features/prediction/api";
import type { Priority } from "../features/prediction/types";
import { useSubscriptions } from "../features/subscription/useSubscriptions";
import type { SubscriptionRecord } from "../features/subscription/types";
import { PageSkeleton } from "../shared/components/PageSkeleton";
import { queryKeys } from "../shared/queryKeys";
import styles from "./AlertsPage.module.css";


const USER_ID = "demo-user";
const DAYS = [
  ["monday", "周一"],
  ["wednesday", "周三"],
  ["friday", "周五"],
] as const;


export function AlertsPage() {
  const locations = useQuery({
    queryKey: queryKeys.locations,
    queryFn: fetchLocations,
    staleTime: Infinity,
  });
  const subscriptions = useSubscriptions(USER_ID);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [originId, setOriginId] = useState("hku");
  const [destinationId, setDestinationId] = useState("nanshan-tech");
  const [arrivalDeadline, setArrivalDeadline] = useState("09:30");
  const [priority, setPriority] = useState<Priority>("balanced");
  const [days, setDays] = useState<string[]>(["monday", "wednesday", "friday"]);
  const [message, setMessage] = useState("");

  function resetForm() {
    setEditingId(null);
    setOriginId("hku");
    setDestinationId("nanshan-tech");
    setArrivalDeadline("09:30");
    setPriority("balanced");
    setDays(["monday", "wednesday", "friday"]);
  }

  function beginEdit(item: SubscriptionRecord) {
    setEditingId(item.subscription_id);
    setOriginId(item.routine.origin_id);
    setDestinationId(item.routine.destination_id);
    setArrivalDeadline(item.routine.arrival_deadline);
    setPriority(item.routine.priority);
    setDays(item.routine.days);
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
        advance_reminder: true,
        anomaly_alert: true,
        better_route_alert: true,
      },
    };
    try {
      if (editingId) {
        await subscriptions.update({ subscriptionId: editingId, payload });
        setMessage("订阅已更新。");
      } else {
        await subscriptions.create({ user_id: USER_ID, ...payload });
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
            <select required value={originId} onChange={(event) => setOriginId(event.target.value)}>
              {locations.data?.origins.map((item) => (
                <option value={item.id} key={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span>目的地</span>
            <select required value={destinationId} onChange={(event) => setDestinationId(event.target.value)}>
              {locations.data?.destinations.map((item) => (
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
          <div className={styles.checkList}>
            <span>✓ 出发前30分钟</span>
            <span>✓ 异常拥堵</span>
            <span>✓ 更优路线</span>
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
                <b>下次提醒约 {item.next_alert}</b>
                <div className={styles.itemActions}>
                  <button onClick={() => beginEdit(item)}>编辑</button>
                  <button onClick={() => void handleDelete(item.subscription_id)} disabled={subscriptions.deleting}>删除</button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
