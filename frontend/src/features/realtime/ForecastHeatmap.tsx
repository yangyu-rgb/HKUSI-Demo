import type { RealtimeResponse } from "./types";
import { englishDisplayText } from "../../shared/displayText";
import styles from "./ForecastHeatmap.module.css";


function pressureClass(wait: number) {
  return wait >= 35 ? styles.high : wait >= 18 ? styles.medium : styles.low;
}


export function ForecastHeatmap({ data }: { data: RealtimeResponse }) {
  const bestByTime = data.ports[0].forecast.map((_, index) => Math.min(...data.ports.map((port) => port.forecast[index].wait)));
  const finalBest = data.ports.reduce((best, port) => port.forecast[3].wait < best.forecast[3].wait ? port : best, data.ports[0]);
  const fastest = data.ports.find((port) => port.id === data.overview.fastest_rising_port_id) ?? data.ports[0];
  return (
    <section className={styles.panel} aria-label="Four-port three-hour pressure heatmap">
      <div className={styles.heading}><div><span className="sectionKicker">Pressure heatmap</span><h2>Four-port pressure by time</h2><p>Darker cells indicate higher wait pressure; a star marks the lowest wait at that time.</p></div><div className={styles.live}><i />LIVE · Refreshes every 60 seconds</div></div>
      <div className={styles.matrix}>
        <div className={styles.corner}>Port / Hong Kong time</div>
        {data.ports[0].forecast.map((point) => <div className={styles.time} key={point.offset_minutes}><strong>{new Date(point.forecast_at).toLocaleTimeString("en-HK", { hour: "2-digit", minute: "2-digit", hour12: false })}</strong><span>{point.offset_minutes === 0 ? "Now" : `+${point.offset_minutes / 60}h`}</span></div>)}
        {data.ports.map((port) => <div className={styles.row} key={port.id}>
          <div className={styles.port}><strong>{englishDisplayText(port.name_en)}</strong><span>{port.trend === "rising" ? "↗ Rising" : port.trend === "falling" ? "↘ Easing" : "→ Stable"}</span></div>
          {port.forecast.map((point, index) => <div className={`${styles.cell} ${pressureClass(point.wait)}`} key={point.offset_minutes}><b>{point.wait}</b><span>min</span>{point.wait === bestByTime[index] && <em>★ Best</em>}<small>{point.change_from_now === 0 ? "Baseline" : `${point.change_from_now > 0 ? "+" : ""}${point.change_from_now}`}</small></div>)}
        </div>)}
      </div>
      <div className={styles.insights}>
        <article><span>Best now</span><strong>{englishDisplayText(data.overview.smoothest_port_name)}</strong><p>{data.overview.smoothest_wait} minutes, suitable for immediate crossing.</p></article>
        <article><span>Best in three hours</span><strong>{englishDisplayText(finalBest.name_en)}</strong><p>Forecast wait: {finalBest.forecast[3].wait} minutes.</p></article>
        <article className={data.overview.fastest_rising_change > 0 ? styles.warning : undefined}><span>Largest change risk</span><strong>{englishDisplayText(fastest.name_en)}</strong><p>{data.overview.fastest_rising_change > 0 ? "+" : ""}{data.overview.fastest_rising_change} minutes over the next hour.</p></article>
      </div>
    </section>
  );
}
