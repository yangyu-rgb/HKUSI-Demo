import { useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { safeNextPath } from "../features/auth/session";
import { useDemoPersonas } from "../features/demo/useDemo";
import { setDemoSession } from "../shared/api/client";
import styles from "./MobileLoginPage.module.css";

export function MobileLoginPage() {
  const personas = useDemoPersonas();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const commuter = personas.data?.personas.find((persona) => persona.role === "commuter");

  function enter() {
    if (!commuter) return;
    queryClient.clear();
    setDemoSession({ personaId: commuter.id, role: "commuter", signedInAt: new Date().toISOString() });
    navigate(safeNextPath(location.search, "/mobile"), { replace: true });
  }

  return (
    <main className={styles.screen}>
      <section className={styles.hero}>
        <div className={styles.brand}><b>CB</b><span><strong>CrossBorder AI</strong><small>Mobile commute</small></span></div>
        <span className={styles.kicker}>Personal cross-border assistant</span>
        <h1>Sign in,<br />then begin today's cross-border journey.</h1>
        <p>Plan routes, compare scenarios, submit on-site reports, and manage personal alerts.</p>
        <div className={styles.pulse}><i /><span>Four-port situation continuously updated</span></div>
      </section>
      <section className={styles.panel}>
        <span>Personal demo sign in</span>
        <h2>Personal commute workspace</h2>
        <p>The mobile app supports the personal persona only. Use the web app for enterprise planning and operations analytics.</p>
        <article>
          <i>{commuter?.name.slice(0, 1) ?? "P"}</i>
          <div><strong>{commuter?.name ?? "Loading persona…"}</strong><small>{commuter?.organization_name ?? "Personal workspace"}</small></div>
          <b>Personal</b>
        </article>
        <button onClick={enter} disabled={!commuter}>Enter mobile app <span>→</span></button>
        <a href="/">View the web Border Situation first</a>
        <small>Classroom Demo · Local persona · No real OAuth connection</small>
      </section>
    </main>
  );
}
