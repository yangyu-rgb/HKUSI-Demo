import { useEffect, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { RealtimeResponse } from "./types";
import styles from "./ForecastChart.module.css";


const COLORS = ["#f5f5f5", "#55d7c1", "#ffc46b", "#ff8375"];


export function ForecastChart({ data }: { data: RealtimeResponse }) {
  const [selectedPortId, setSelectedPortId] = useState(data.overview.smoothest_port_id);
  useEffect(() => { setSelectedPortId(data.overview.smoothest_port_id); }, [data.overview.smoothest_port_id]);
  const selectedPort = data.ports.find((port) => port.id === selectedPortId) ?? data.ports[0];
  const selectedColor = COLORS[data.ports.findIndex((port) => port.id === selectedPort.id)];
  const chartData = useMemo(() => data.ports[0].forecast.map((point, pointIndex) => {
    const at = new Date(point.forecast_at).toLocaleTimeString("zh-HK", { hour: "2-digit", minute: "2-digit", hour12: false });
    const row: Record<string, string | number | number[]> = { time: point.offset_minutes === 0 ? `现在 ${at}` : at };
    data.ports.forEach((port) => {
      const forecast = port.forecast[pointIndex];
      row[port.name] = forecast.wait;
      row[`${port.name}区间`] = [forecast.lower_bound, forecast.upper_bound];
    });
    return row;
  }), [data]);
  const yMax = Math.max(...data.ports.flatMap((port) => port.forecast.map((point) => point.upper_bound)), 40) + 5;

  return (
    <section className={styles.panel} aria-label="四口岸未来三小时等待趋势">
      <div className={styles.heading}>
        <div><span className="sectionKicker">Forecast command view</span><h2>未来三小时等待趋势</h2><p>香港时间 · 阴影为所选口岸 90% 区间 · 背景为压力阈值</p></div>
        <div className={styles.portSwitch} aria-label="选择突出显示的口岸">
          {data.ports.map((port, index) => <button key={port.id} className={port.id === selectedPort.id ? styles.active : undefined} style={{ "--port-color": COLORS[index] } as React.CSSProperties} onClick={() => setSelectedPortId(port.id)}>{port.name}</button>)}
        </div>
      </div>
      <div className={styles.selectedSummary}><span>当前聚焦</span><strong>{selectedPort.name}</strong><b>{selectedPort.current_wait} 分钟</b><em>{selectedPort.change_next_hour > 0 ? "+" : ""}{selectedPort.change_next_hour} 分钟 / 未来1h</em></div>
      <div className={styles.chart}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 12, right: 24, left: 0, bottom: 5 }}>
            <ReferenceArea y1={0} y2={18} fill="#55d7c1" fillOpacity={0.07} />
            <ReferenceArea y1={18} y2={35} fill="#ffc46b" fillOpacity={0.06} />
            <ReferenceArea y1={35} y2={yMax} fill="#ff8375" fillOpacity={0.055} />
            <CartesianGrid strokeDasharray="3 4" stroke="rgba(255,255,255,.1)" vertical={false} />
            <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#8e8e8e" }} />
            <YAxis width={44} domain={[0, yMax]} unit="分" tick={{ fontSize: 10, fill: "#8e8e8e" }} />
            <Tooltip formatter={(value, name) => [Array.isArray(value) ? `${value[0]}–${value[1]} 分钟` : `${value} 分钟`, name]} contentStyle={{ color: "#f5f5f5", background: "#111", borderRadius: 12, borderColor: "rgba(255,255,255,.16)", boxShadow: "0 16px 40px rgba(0,0,0,.4)" }} />
            <Area type="monotone" dataKey={`${selectedPort.name}区间`} stroke="none" fill={selectedColor} fillOpacity={0.13} activeDot={false} legendType="none" />
            {data.ports.map((port, index) => <Line key={port.id} type="monotone" dataKey={port.name} stroke={COLORS[index]} strokeWidth={port.id === selectedPort.id ? 4 : 2} strokeOpacity={port.id === selectedPort.id ? 1 : 0.3} dot={{ r: port.id === selectedPort.id ? 5 : 3, fill: COLORS[index], strokeWidth: 0 }} activeDot={{ r: 7 }} />)}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className={styles.thresholds}><span><i className={styles.clear} />畅通 &lt;18分</span><span><i className={styles.busy} />繁忙 18–34分</span><span><i className={styles.crowded} />拥挤 ≥35分</span></div>
    </section>
  );
}
