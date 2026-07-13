import type { components } from "../../generated/api";
import { request } from "../../shared/api/client";

export type CommercialPlans = components["schemas"]["CommercialPlansResponse"];
export type CommercialSubscription = components["schemas"]["CommercialSubscriptionResponse"];
export type CommercialCheckout = components["schemas"]["CommercialCheckoutResponse"];
export type CheckoutInput = components["schemas"]["CommercialCheckoutRequest"];

export const fetchCommercialPlans = (): Promise<CommercialPlans> => request("/api/commercial/plans");
export const fetchCommercialSubscription = (): Promise<CommercialSubscription> => request("/api/commercial/subscription");
export const checkoutCommercialPlan = (input: CheckoutInput): Promise<CommercialCheckout> => request("/api/commercial/checkout", { method: "POST", body: JSON.stringify(input) });
export const cancelCommercialSubscription = (): Promise<CommercialSubscription> => request("/api/commercial/subscription/cancel", { method: "POST" });

