export type TopicId = "wastewise" | "clinicflow" | "hireready";

export type Metric = {
  label: string;
  value: string;
  trend: string;
};

export type AnalysisCard = {
  title: string;
  body: string;
};

export type Report = {
  headline: string;
  primaryMetric: string;
  secondaryMetric: string;
  nextStep: string;
};

export type TableRow = {
  item: string;
  baseline: number;
  forecast: number;
  risk: string;
  action: string;
};

export type DemoState = {
  topic: TopicId;
  title: string;
  subtitle: string;
  scenario: string;
  metrics: Metric[];
  analysis: AnalysisCard[];
  recommendations: string[];
  report: Report;
  table: TableRow[];
};

