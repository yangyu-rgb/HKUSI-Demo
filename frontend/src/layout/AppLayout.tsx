import { NavLink, Outlet } from "react-router-dom";
import styles from "./AppLayout.module.css";


const navigation = [
  { to: "/", label: "口岸态势", end: true },
  { to: "/planner", label: "路线预测" },
  { to: "/crowdsource", label: "众包反馈" },
  { to: "/alerts", label: "智能提醒" },
  { to: "/business", label: "企业方案" },
];


export function AppLayout() {
  return (
    <>
      <header className={styles.header}>
        <NavLink className={styles.brand} to="/">
          <span className={styles.brandMark}>CB</span>
          <span>
            <strong>CrossBorder AI</strong>
            <small>深港跨境智能规划</small>
          </span>
        </NavLink>
        <nav className={styles.navigation} aria-label="主要导航">
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
        <span className={styles.demoChip}>Deterministic Demo</span>
      </header>
      <Outlet />
      <footer className={styles.footer}>
        <strong>CrossBorder AI</strong>
        <span>SIUS2612 Topic 2 · Local deterministic prototype · No live border data</span>
      </footer>
    </>
  );
}
