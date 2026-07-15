import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getDemoSession } from "../features/auth/session";
import { userFacingError } from "../shared/api/client";
import { PageSkeleton } from "../shared/components/PageSkeleton";
import { useCommercial } from "../features/commercial/useCommercial";
import type { CheckoutInput } from "../features/commercial/api";
import styles from "./PricingPage.module.css";

export function PricingPage() {
  const session = getDemoSession();
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const initialCycle = params.get("cycle") === "monthly" ? "monthly" : "yearly";
  const [cycle, setCycle] = useState<"monthly" | "yearly">(initialCycle);
  const [selected, setSelected] = useState<string | null>(session ? params.get("plan") : null);
  const commercial = useCommercial(Boolean(session));
  if (commercial.plans.isPending || (session && commercial.subscription.isPending)) return <PageSkeleton cards={3} />;
  if (!commercial.plans.data) return <main className="page"><p className="formError">{userFacingError(commercial.plans.error)}</p></main>;
  const current = commercial.subscription.data?.subscription;
  const chosen = commercial.plans.data.plans.find((plan) => plan.id === selected);
  const checkout = async () => {
    if (!chosen) return;
    await commercial.checkout.mutateAsync({ plan_id: chosen.id, billing_cycle: cycle } as CheckoutInput);
    setSelected(null);
  };
  const choosePlan = (planId: string) => {
    if (!session) {
      const next = `/pricing?plan=${encodeURIComponent(planId)}&cycle=${cycle}`;
      navigate(`/login?next=${encodeURIComponent(next)}`);
      return;
    }
    setSelected(planId);
  };
  return (
    <main>
      <section className={styles.hero}><span className="sectionKicker">Commercial demo</span><h1>From forecasting capability to a<br />purchasable operations service.</h1><p>Clear plans show how individuals, teams, and enterprises can buy forecasting, batch dispatch, and operations analytics.</p><div className={styles.cycle}><button className={cycle === "monthly" ? styles.active : ""} onClick={() => setCycle("monthly")}>Monthly</button><button className={cycle === "yearly" ? styles.active : ""} onClick={() => setCycle("yearly")}>Yearly · Save about 17%</button></div></section>
      <section className={styles.page}>
        {current && <div className={styles.current}><div><small>Current local subscription</small><strong>{current.plan_name} · {current.status === "active" ? "Active" : "Cancelled"}</strong><span>Demo receipt {current.receipt_id} · Renews {new Date(current.renews_at).toLocaleDateString("en-HK")}</span></div>{current.status === "active" && <button onClick={() => commercial.cancel.mutate()}>Cancel local subscription</button>}</div>}
        {!session && <div className={styles.guestNotice}>Plans are publicly viewable. Sign in with a local Demo persona to select one.</div>}
        <div className={styles.plans}>{commercial.plans.data.plans.map((plan) => { const price = cycle === "monthly" ? plan.monthly_price_hkd : plan.yearly_price_hkd; return <article className={plan.highlighted ? styles.highlighted : ""} key={plan.id}>{plan.highlighted && <b className={styles.popular}>Recommended business plan</b>}<span>{plan.audience}</span><h2>{plan.name}</h2><p>{plan.description}</p><div className={styles.price}><strong>HK${price.toLocaleString()}</strong><small>/{cycle === "monthly" ? "month" : "year"}</small></div><ul>{plan.features.map((feature, index) => <li key={`${plan.id}-${index}`}>✓ {feature}</li>)}</ul><button onClick={() => choosePlan(plan.id)}>{!session ? "Sign in to select" : current?.plan_id === plan.id && current.status === "active" ? "Change billing cycle" : plan.id === "starter" ? "Enable free plan" : "Simulate purchase"}</button></article>; })}</div>
        <section className={styles.businessCase}><div><span className="sectionKicker">Business case</span><h2>How business value is presented</h2></div><div><article><strong>Reduce manual rerouting</strong><span>Review risk and alternatives across four ports</span></article><article><strong>Lower late-arrival risk</strong><span>Work backwards to the latest departure by employee and batch</span></article><article><strong>Create a data service</strong><span>Monetize analytics, CSV exports, and future API usage</span></article></div></section>
      </section>
      {chosen && <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="checkout-title"><div><button className={styles.close} aria-label="Close checkout" onClick={() => setSelected(null)}>×</button><span className="sectionKicker">Demo checkout</span><h2 id="checkout-title">Confirm {chosen.name}</h2><p>This page does not collect card, WeChat Pay, or any other real payment information.</p><dl><div><dt>Billing cycle</dt><dd>{cycle === "monthly" ? "Monthly" : "Yearly"}</dd></div><div><dt>Simulated amount</dt><dd>HK${(cycle === "monthly" ? chosen.monthly_price_hkd : chosen.yearly_price_hkd).toLocaleString()}</dd></div><div><dt>Payment method</dt><dd>Demo Payment · No real charge</dd></div></dl><button className={styles.confirm} disabled={commercial.checkout.isPending} onClick={() => void checkout()}>{commercial.checkout.isPending ? "Generating local receipt…" : "Confirm simulated checkout"}</button>{commercial.checkout.error && <p className="formError">{userFacingError(commercial.checkout.error)}</p>}</div></div>}
    </main>
  );
}
