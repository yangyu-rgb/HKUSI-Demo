import type { Dispatch, FormEvent, SetStateAction } from "react";
import type {
  LocationsResponse,
  PredictionQueryInput,
  Priority,
} from "./types";
import styles from "./PlannerForm.module.css";


type Props = {
  locations: LocationsResponse;
  query: PredictionQueryInput;
  setQuery: Dispatch<SetStateAction<PredictionQueryInput>>;
  predicting: boolean;
  minTargetTime: string;
  maxTargetTime: string;
  onSubmit: () => Promise<void>;
};


export function PlannerForm({
  locations,
  query,
  setQuery,
  predicting,
  minTargetTime,
  maxTargetTime,
  onSubmit,
}: Props) {
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void onSubmit();
  }
  const selectedDirection = locations.directions.find(
    (item) => item.id === query.direction,
  ) ?? locations.directions[0];
  const origins = locations.origins.filter(
    (item) => selectedDirection.origin_ids.includes(item.id),
  );
  const destinations = locations.destinations.filter(
    (item) => selectedDirection.destination_ids.includes(item.id),
  );

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label>
        <span>通勤方向</span>
        <select
          value={query.direction}
          onChange={(event) => {
            const direction = locations.directions.find(
              (item) => item.id === event.target.value,
            ) ?? locations.directions[0];
            setQuery({
              ...query,
              direction: direction.id,
              origin_id: direction.origin_ids[0],
              destination_id: direction.destination_ids[0],
            });
          }}
        >
          {locations.directions.map((direction) => (
            <option value={direction.id} key={direction.id}>{direction.label}</option>
          ))}
        </select>
      </label>
      <label>
        <span>出发地</span>
        <select
          required
          value={query.origin_id}
          onChange={(event) => setQuery({ ...query, origin_id: event.target.value })}
        >
          {origins.map((location) => (
            <option value={location.id} key={location.id}>{location.name}</option>
          ))}
        </select>
      </label>
      <label>
        <span>目的地</span>
        <select
          required
          value={query.destination_id}
          onChange={(event) => setQuery({ ...query, destination_id: event.target.value })}
        >
          {destinations.map((location) => (
            <option value={location.id} key={location.id}>{location.name}</option>
          ))}
        </select>
      </label>
      <label>
        <span>最迟到达</span>
        <input
          type="datetime-local"
          required
          min={minTargetTime.slice(0, 16)}
          max={maxTargetTime.slice(0, 16)}
          value={query.target_time}
          onChange={(event) => setQuery({ ...query, target_time: event.target.value })}
        />
      </label>
      <label>
        <span>优化偏好</span>
        <select
          value={query.priority}
          onChange={(event) => setQuery({ ...query, priority: event.target.value as Priority })}
        >
          <option value="balanced">稳妥均衡</option>
          <option value="fastest">时间最快</option>
          <option value="cheapest">费用最低</option>
        </select>
      </label>
      <label>
        <span>预算上限（HK$）</span>
        <input
          type="number"
          min="0"
          value={query.max_budget ?? ""}
          placeholder="不限"
          onChange={(event) => setQuery({
            ...query,
            max_budget: event.target.value === "" ? null : Number(event.target.value),
          })}
        />
      </label>
      <button className="button buttonPrimary" disabled={predicting}>
        {predicting ? "正在计算…" : "生成 AI 建议"}
      </button>
    </form>
  );
}
