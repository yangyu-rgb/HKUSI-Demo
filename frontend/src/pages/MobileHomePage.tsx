import { Link } from "react-router-dom";
import { useRealtime } from "../features/realtime/useRealtime";
import { ErrorState } from "../shared/components/PageState";
import { PageSkeleton } from "../shared/components/PageSkeleton";
import styles from "./MobileHomePage.module.css";


export function MobileHomePage() {
  const { data, loading, error } = useRealtime();
  if (loading) return <PageSkeleton cards={3} />;
  if (!data || error) return <ErrorState title="Mobile home is temporarily unavailable" detail={error || "Start the backend service and try again."} />;

  const ranked = [...data.ports].sort((left, right) => left.current_wait - right.current_wait);
  return (
    <main className={styles.mobileShell}>
      <section className={styles.hero}>
        <span>CrossBorder AI · Mobile</span>
        <h1>Which port should I use now?</h1>
        <p>The mobile app reorganizes the same AI calculations used by the classroom Demo.</p>
        <div className={styles.best}>
          <div><small>Best now</small><strong>{data.overview.smoothest_port_name}</strong></div>
          <b>{data.overview.smoothest_wait}<i>min</i></b>
        </div>
      </section>

      <section className={styles.sourceStrip} aria-label="Data sources">
        <span>Hong Kong official passenger flow · Primary feature</span>
        <span>Shenzhen official snapshot · Cross-check</span>
        <small>Classroom estimates, not live field measurements</small>
      </section>

      <section className={styles.quickGrid}>
        <Link to="/mobile/planner"><strong>Plan now</strong><span>Compare four ports</span></Link>
        <Link to="/mobile/scenarios"><strong>Scenario preview</strong><span>Heavy rain and events</span></Link>
        <Link to="/mobile/feedback"><strong>On-site report</strong><span>Contribute to transparent calibration</span></Link>
        <Link to="/mobile/me"><strong>My commute</strong><span>Alerts, notifications, and model</span></Link>
      </section>

      <section className={styles.ports}>
        <div className={styles.sectionTitle}><h2>Four-port situation</h2><span>Updates every 60 seconds</span></div>
        {ranked.map((port, index) => (
          <article key={port.id}>
            <b>{index + 1}</b>
            <div><strong>{port.name_en}</strong><small>{port.status === "open" ? "Open" : "Status notice"} · {port.crowd_level}</small></div>
            <span>{port.current_wait}<i>min</i></span>
          </article>
        ))}
      </section>

    </main>
  );
}
