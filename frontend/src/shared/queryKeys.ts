export const queryKeys = {
  demoContext: ["demo-context"] as const,
  modelShadowSummary: ["model-shadow-summary"] as const,
  v2Readiness: ["v2-readiness"] as const,
  realtime: ["realtime"] as const,
  crowdsource: ["crowdsource"] as const,
  locations: ["locations"] as const,
  prediction: (query: unknown) => ["prediction", query] as const,
  subscriptions: (userId: string) => ["subscriptions", userId] as const,
  subscriptionPreview: (subscriptionId: string) => ["subscription-preview", subscriptionId] as const,
  subscriptionEvaluations: (subscriptionId: string) => ["subscription-evaluations", subscriptionId] as const,
  batchPlans: (company: string) => ["batch-plans", company] as const,
};
