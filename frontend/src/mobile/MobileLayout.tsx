import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useDemoContext } from "../features/demo/useDemo";
import { useHongKongClock } from "../features/demo/useHongKongClock";
import { formatClock } from "../shared/formatters";
import { MobileSessionProvider } from "./MobileSession";
import styles from "./MobileLayout.module.css";


const navigation = [
  { to: "/mobile", label: "Home", end: true },
  { to: "/mobile/planner", label: "Plan" },
  { to: "/mobile/scenarios", label: "Scenarios" },
  { to: "/mobile/feedback", label: "Report" },
  { to: "/mobile/me", label: "My commute" },
];


export function MobileLayout() {
  const context = useDemoContext();
  const hongKongTime = useHongKongClock(context.data?.current_time);
  const [online, setOnline] = useState(navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    const beforeInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event); };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    window.addEventListener("beforeinstallprompt", beforeInstall);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("beforeinstallprompt", beforeInstall);
    };
  }, []);
  const install = async () => {
    if (!installPrompt) return;
    await (installPrompt as Event & { prompt: () => Promise<void> }).prompt();
    setInstallPrompt(null);
  };
  return (
    <MobileSessionProvider>
      <div className={styles.viewport}>
        <header className={styles.header}>
          <NavLink to="/mobile" className={styles.brand} aria-label="CrossBorder AI mobile home">
            <b>CB</b><span><strong>CrossBorder AI</strong><small>Mobile</small></span>
          </NavLink>
          <time dateTime={hongKongTime?.toISOString()}>
            <small>Hong Kong time</small><strong>{hongKongTime ? formatClock(hongKongTime.toISOString()) : "Syncing"}</strong>
          </time>
          <div className={styles.headerActions}>
            {!online && <span className={styles.offline}>Offline</span>}
            {installPrompt && <button onClick={() => void install()}>Install</button>}
            <Link to="/" aria-label="Return to web app">Web app ↗</Link>
          </div>
        </header>
        <Outlet />
        <nav className={styles.bottomNav} aria-label="Mobile quick navigation">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => isActive ? styles.active : undefined}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </MobileSessionProvider>
  );
}
