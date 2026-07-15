import { Link } from "react-router-dom";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ForecastChart } from "../features/realtime/ForecastChart";
import { ForecastHeatmap } from "../features/realtime/ForecastHeatmap";
import { PortCard } from "../features/realtime/PortCard";
import { useRealtime } from "../features/realtime/useRealtime";
import { ErrorState } from "../shared/components/PageState";
import { PageSkeleton } from "../shared/components/PageSkeleton";
import { formatHongKongDateTime } from "../shared/formatters";
import { AnimatedHeading, FadeIn, Reveal, useReducedMotion } from "../shared/motion/Motion";
import styles from "./HomePage.module.css";


const PortFlowScene = lazy(() => import("../features/realtime/PortFlowScene").then((module) => ({ default: module.PortFlowScene })));


export function HomePage() {
  const { data, loading, refreshing, error, refresh, dataUpdatedAt } = useRealtime();
  const reducedMotion = useReducedMotion();
  const videoRef = useRef<HTMLVideoElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [manuallyPaused, setManuallyPaused] = useState(false);

  useEffect(() => {
    const hero = heroRef.current;
    const video = videoRef.current;
    if (!hero || !video || reducedMotion) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) video.pause();
      else if (!manuallyPaused) void video.play().catch(() => setVideoFailed(true));
    }, { threshold: 0.15 });
    observer.observe(hero);
    return () => observer.disconnect();
  }, [manuallyPaused, reducedMotion]);

  if (loading) {
    return <PageSkeleton />;
  }
  if (error || !data) {
    return <ErrorState title="Cannot connect to the CrossBorder AI backend" detail={error || "Start the FastAPI service and try again."} />;
  }

  const rankByPort = new Map([...data.ports].sort((left, right) => left.current_wait - right.current_wait).map((port, index) => [port.id, index + 1]));
  const openPortCount = data.ports.filter((port) => port.status === "open").length;
  return (
    <main>
      <section className={styles.hero} ref={heroRef}>
        {!reducedMotion && !videoFailed && <video
          ref={videoRef}
          className={styles.heroVideo}
          src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260403_050628_c4e32401-fab4-4a27-b7a8-6e9291cd5959.mp4"
          poster="/hero-city-poster.jpg"
          autoPlay
          loop
          muted
          playsInline
          onError={() => setVideoFailed(true)}
          aria-hidden="true"
        />}
        <img className={`${styles.heroPoster} ${!reducedMotion && !videoFailed ? styles.posterBehindVideo : ""}`} src="/hero-city-poster.jpg" alt="" aria-hidden="true" />
        <div className={styles.heroCopy}>
          <FadeIn delay={500} duration={800}><span className={styles.heroKicker}>AI predictive operations for cross-border transport</span></FadeIn>
          <AnimatedHeading className={styles.heroHeading} text={"Predict border uncertainty.\nDispatch with confidence."} />
          <FadeIn delay={800}><p className={styles.heroDescription}>Turn 1–3 hour border forecasts into trip, fleet, and coordination decisions.<br />Compare operational risk before committing resources.</p></FadeIn>
          <FadeIn delay={1200} className={styles.heroActionReveal}>
            <div className={styles.heroActions}>
              <Link className={styles.primaryAction} to="/login?next=%2Fbusiness">Open Operations Control Tower</Link>
              <Link className={`${styles.secondaryAction} liquid-glass`} to="/planner">Personal Route Planner</Link>
              <span className={styles.liveStatus}><i />Live calculation · {formatHongKongDateTime(data.timestamp)}</span>
            </div>
          </FadeIn>
        </div>
        <FadeIn delay={1400} className={styles.signalReveal}>
          <div className={styles.signal} aria-label="Platform capability summary">
            <div className="liquid-glass"><strong>{data.overview.smoothest_port_name}</strong><span>Lowest wait · {data.overview.smoothest_wait} min</span></div>
            <div className="liquid-glass"><strong>{data.overview.highest_pressure_port_name}</strong><span>Highest pressure · {data.overview.highest_pressure_wait} min</span></div>
            <div className="liquid-glass"><strong>{data.overview.fastest_rising_port_name}</strong><span>Next-hour change · {data.overview.fastest_rising_change > 0 ? "+" : ""}{data.overview.fastest_rising_change} min</span></div>
            <div className="liquid-glass"><strong>{data.overview.crowdsource_report_count}</strong><span>Valid reports · {data.overview.active_anomaly_count} anomalies</span></div>
          </div>
        </FadeIn>
        {!reducedMotion && !videoFailed && <button className={`${styles.videoControl} liquid-glass`} type="button" onClick={() => {
          const video = videoRef.current;
          if (!video) return;
          if (video.paused) { void video.play(); setManuallyPaused(false); }
          else { video.pause(); setManuallyPaused(true); }
        }}>{manuallyPaused ? "Play background" : "Pause background"}</button>}
      </section>

      <div id="border-status" className={styles.statusAnchor}>
        {data.alerts.map((alert, index) => (
          <Reveal delay={index * 80} key={`${alert.severity}-${index}`}><div className={`${styles.alert} ${styles[alert.severity]}`}>
            <span>{alert.severity === "high" ? "High-risk alert" : alert.severity === "medium" ? "Situation update" : "Operations note"}</span>
            <p>{alert.message}</p>
          </div></Reveal>
        ))}
      </div>

      <Reveal><Suspense fallback={<section className={styles.flowFallback}>Loading the 3D border flow view…</section>}><PortFlowScene ports={data.ports} /></Suspense></Reveal>

      <section className="pageSection" aria-labelledby="port-status-title">
        <div className="sectionHeading">
          <div><span className="sectionKicker">Simulated border pulse</span><h2 id="port-status-title">Four-port live situation</h2></div>
          <div className={styles.refresh}>
            <span>{openPortCount}/4 ports open · Updated {new Date(dataUpdatedAt).toLocaleTimeString("en-HK")}</span>
            <button onClick={() => void refresh()} disabled={refreshing}>
              {refreshing ? "Refreshing…" : "Refresh now"}
            </button>
          </div>
        </div>
        <div className={styles.portGrid}>
          {data.ports.map((port) => (
            <div id={`port-card-${port.id}`} key={port.id}>
              <PortCard port={port} rank={rankByPort.get(port.id) ?? 4} />
            </div>
          ))}
        </div>
        <ForecastChart data={data} />
        <ForecastHeatmap data={data} />
      </section>
    </main>
  );
}
