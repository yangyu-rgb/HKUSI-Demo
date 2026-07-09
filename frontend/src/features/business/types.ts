export type BatchPlanResponse = {
  company: string;
  date: string;
  plan: Array<{
    employee_id: number | string;
    recommended_port: string;
    departure_time: string;
    total_time: number;
    late_risk_percent: number;
  }>;
  summary: {
    employee_count: number;
    avg_commute_time: number;
    high_risk_count: number;
    recommendation: string;
  };
};
