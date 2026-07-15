import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { getDemoSession, type DemoRole } from "./session";
import styles from "./RequireAccess.module.css";

const roleNames: Record<DemoRole, string> = {
  operator: "Demo operator",
  commuter: "personal commuter",
  business_admin: "enterprise administrator",
  transport_dispatcher: "transport dispatcher",
  port_official: "port coordinator",
};

type RequireAccessProps = {
  allowedRoles: DemoRole[];
  mobile?: boolean;
};

export function RequireAccess({ allowedRoles, mobile = false }: RequireAccessProps) {
  const location = useLocation();
  const session = getDemoSession();
  const next = `${location.pathname}${location.search}`;
  if (!session) {
    const login = mobile ? "/mobile/login" : "/login";
    return <Navigate to={`${login}?next=${encodeURIComponent(next)}`} replace />;
  }
  if (!allowedRoles.includes(session.role)) {
    const login = mobile ? "/mobile/login" : "/login";
    return (
      <main className={mobile ? styles.mobilePage : styles.page}>
        <section className={styles.card}>
          <span>Access policy</span>
          <h1>This persona cannot access this feature</h1>
          <p>You are signed in as a {roleNames[session.role]}. This page requires {allowedRoles.map((role) => roleNames[role]).join(" or ")} access.</p>
          <div>
            <Link className={styles.primary} to={`${login}?next=${encodeURIComponent(next)}`}>Switch persona</Link>
            <Link to={mobile ? "/" : "/"}>Return to Border Situation</Link>
          </div>
          <small>This access policy only demonstrates classroom Demo roles; it is not production authentication.</small>
        </section>
      </main>
    );
  }
  return <Outlet />;
}
