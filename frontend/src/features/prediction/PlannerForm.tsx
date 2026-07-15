import type { FormEvent } from "react";
import type {
  LocationsResponse,
  PredictionQueryInput,
  Priority,
} from "./types";
import { LocationCombobox } from "./LocationCombobox";
import styles from "./PlannerForm.module.css";


type Props = {
  locations: LocationsResponse;
  query: PredictionQueryInput;
  setQuery: (query: PredictionQueryInput) => void;
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
        <span>Travel direction</span>
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
      <LocationCombobox label="Origin" value={query.origin_id} options={origins} onChange={(origin_id) => setQuery({ ...query, origin_id })} />
      <LocationCombobox label="Destination" value={query.destination_id} options={destinations} onChange={(destination_id) => setQuery({ ...query, destination_id })} />
      <label>
        <span>Latest arrival</span>
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
        <span>Optimization preference</span>
        <select
          value={query.priority}
          onChange={(event) => setQuery({ ...query, priority: event.target.value as Priority })}
        >
          <option value="balanced">Balanced</option>
          <option value="fastest">Fastest</option>
          <option value="cheapest">Lowest cost</option>
        </select>
      </label>
      <label>
        <span>Budget cap (HK$)</span>
        <input
          type="number"
          min="0"
          value={query.max_budget ?? ""}
          placeholder="No limit"
          onChange={(event) => setQuery({
            ...query,
            max_budget: event.target.value === "" ? null : Number(event.target.value),
          })}
        />
      </label>
      <button className="button buttonPrimary" disabled={predicting}>
        {predicting ? "Calculating…" : "Generate AI recommendation"}
      </button>
    </form>
  );
}
