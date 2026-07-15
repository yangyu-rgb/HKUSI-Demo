import type { PortPrediction } from "./types";
import styles from "./RouteSchematic.module.css";


export function RouteSchematic({
  origin,
  destination,
  route,
}: {
  origin: string;
  destination: string;
  route: PortPrediction;
}) {
  const access = route.route.steps[0];
  const onward = route.route.steps[2];
  return (
    <section className={styles.panel}>
      <div className={styles.heading}>
        <div>
          <span className="sectionKicker">Route schematic</span>
          <h2>Recommended route schematic</h2>
        </div>
        <p>Local schematic; not to geographic scale</p>
      </div>
      <svg
        className={styles.map}
        viewBox="0 0 900 190"
        role="img"
        aria-label={`${origin} to ${destination} via ${route.name_en} Port`}
      >
        <title>{origin} to {destination} via {route.name_en} Port</title>
        <path d="M115 95 H405" className={styles.accessLine} />
        <path d="M495 95 H785" className={styles.onwardLine} />
        <circle cx="90" cy="95" r="25" className={styles.originNode} />
        <circle cx="450" cy="95" r="34" className={styles.portNode} />
        <circle cx="810" cy="95" r="25" className={styles.destinationNode} />
        <text x="90" y="100" textAnchor="middle" className={styles.nodeCode}>HK</text>
        <text x="450" y="100" textAnchor="middle" className={styles.portCode}>BP</text>
        <text x="810" y="100" textAnchor="middle" className={styles.nodeCode}>SZ</text>
        <text x="90" y="145" textAnchor="middle" className={styles.label}>{origin}</text>
        <text x="450" y="150" textAnchor="middle" className={styles.label}>{route.name_en} Port</text>
        <text x="810" y="145" textAnchor="middle" className={styles.label}>{destination}</text>
        <text x="260" y="73" textAnchor="middle" className={styles.mode}>
          {access?.mode.toUpperCase()} · {access?.duration} min
        </text>
        <text x="640" y="73" textAnchor="middle" className={styles.mode}>
          {onward?.mode.toUpperCase()} · {onward?.duration} min
        </text>
        <text x="450" y="39" textAnchor="middle" className={styles.wait}>
          Forecast crossing: {route.predicted_wait_time} min
        </text>
      </svg>
    </section>
  );
}
