import { useEffect, useState, type FormEvent } from "react";
import {
  createBatchPlan,
  createSubscription,
  fetchCrowdsourceFeed,
  fetchPrediction,
  fetchRealtime,
  submitCrowdsourceReport
} from "./api";
import type {
  BatchPlanResponse,
  CrowdLevel,
  CrowdsourceReport,
  PortPrediction,
  PortStatus,
  PredictionResponse,
  Priority,
  RealtimeResponse
} from "./types";

const DEFAULT_QUERY = {
  departure: "香港大学",
  destination: "深圳南山科技园",
  target_time: "2026-07-09T09:30",
  priority: "balanced" as Priority
};

const CROWD_LABELS: Record<CrowdLevel, string> = {
  low: "畅通",
  medium: "正常",
  high: "拥挤"
};

const RISK_LABELS = {
  low: "低风险",
  medium: "中风险",
  high: "高风险"
};

function formatDemoTime(value: string) {
  return value.replace("T", " ").slice(0, 16);
}

function PortCard({ port }: { port: PortStatus }) {
  const maxWait = Math.max(...port.forecast.map((point) => point.wait), 1);
  return (
    <article className="port-card">
      <div className="port-card__top">
        <div>
          <span className={`status-dot status-dot--${port.crowd_level}`} />
          <strong>{port.name}</strong>
          <small>{port.name_en}</small>
        </div>
        <span className={`crowd-pill crowd-pill--${port.crowd_level}`}>
          {CROWD_LABELS[port.crowd_level]}
        </span>
      </div>
      <div className="wait-row">
        <span>当前等待</span>
        <strong>{port.current_wait}<small>分钟</small></strong>
      </div>
      <div className="mini-forecast" aria-label={`${port.name}未来两小时预测`}>
        {port.forecast.map((point) => (
          <div className="mini-forecast__item" key={point.offset_minutes}>
            <div className="mini-forecast__track">
              <span style={{ height: `${Math.max(24, (point.wait / maxWait) * 100)}%` }} />
            </div>
            <b>{point.wait}</b>
            <small>{point.offset_minutes === 0 ? "现在" : `+${point.offset_minutes / 60}h`}</small>
          </div>
        ))}
      </div>
      <div className="port-card__meta">
        <span>{port.special_channels[0]}</span>
        <span>{port.crowdsource_count} 条现场反馈</span>
      </div>
    </article>
  );
}

function RouteCard({ route, recommended }: { route: PortPrediction; recommended: boolean }) {
  return (
    <article className={`route-card ${recommended ? "route-card--recommended" : ""}`}>
      <div className="route-card__header">
        <div>
          {recommended && <span className="recommend-badge">AI 推荐</span>}
          <h3>{route.name}口岸</h3>
          <p>{route.name_en}</p>
        </div>
        <span className={`risk-tag risk-tag--${route.risk_level}`}>
          {RISK_LABELS[route.risk_level]}
        </span>
      </div>
      <div className="route-metrics">
        <div><span>全程</span><strong>{route.total_time} 分钟</strong></div>
        <div><span>预计费用</span><strong>HK${route.total_cost}</strong></div>
        <div><span>口岸等待</span><strong>{route.predicted_wait_time} 分钟</strong></div>
        <div><span>迟到风险</span><strong>{route.late_risk_percent}%</strong></div>
      </div>
      <div className="confidence-line">
        预测区间 {route.confidence_interval[0]}–{route.confidence_interval[1]} 分钟
        {route.crowdsource_enhanced && ` · 已融合 ${route.crowdsource_count} 条众包数据`}
      </div>
      <div className="route-steps">
        {route.route.steps.map((step, index) => (
          <div className="route-step" key={`${step.mode}-${step.label}`}>
            <span className="route-step__index">{index + 1}</span>
            <div><strong>{step.label}</strong><small>{step.duration} 分钟 · HK${step.cost}</small></div>
          </div>
        ))}
      </div>
      {route.anomalies.length > 0 && <p className="route-alert">注意：{route.anomalies[0]}</p>}
    </article>
  );
}

function FeedItem({ report }: { report: CrowdsourceReport }) {
  return (
    <article className="feed-item">
      <div className={`avatar avatar--${report.crowd_level}`}>
        {report.port.slice(0, 1)}
      </div>
      <div>
        <div className="feed-item__meta">
          <strong>{report.port} · {report.actual_wait_time} 分钟</strong>
          <span>{report.time_label}</span>
        </div>
        <p>{report.comment}</p>
        <small>@{report.user_id} · {CROWD_LABELS[report.crowd_level]}</small>
      </div>
    </article>
  );
}

function App() {
  const [realtime, setRealtime] = useState<RealtimeResponse | null>(null);
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null);
  const [feed, setFeed] = useState<CrowdsourceReport[]>([]);
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [pageStatus, setPageStatus] = useState<"loading" | "ready" | "error">("loading");
  const [predicting, setPredicting] = useState(false);
  const [reportPort, setReportPort] = useState("福田");
  const [reportWait, setReportWait] = useState(12);
  const [reportCrowd, setReportCrowd] = useState<CrowdLevel>("low");
  const [reportComment, setReportComment] = useState("排队很短，通关顺畅。");
  const [reportMessage, setReportMessage] = useState("");
  const [arrivalDeadline, setArrivalDeadline] = useState("09:30");
  const [subscriptionMessage, setSubscriptionMessage] = useState("");
  const [batchPlan, setBatchPlan] = useState<BatchPlanResponse | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      fetchRealtime(),
      fetchCrowdsourceFeed(),
      fetchPrediction({
        departure: DEFAULT_QUERY.departure,
        destination: DEFAULT_QUERY.destination,
        target_time: DEFAULT_QUERY.target_time,
        preferences: { priority: DEFAULT_QUERY.priority }
      })
    ])
      .then(([realtimeData, feedData, predictionData]) => {
        setRealtime(realtimeData);
        setFeed(feedData.reports);
        setPrediction(predictionData);
        setPageStatus("ready");
      })
      .catch(() => setPageStatus("error"));
  }, []);

  async function handlePrediction(event: FormEvent) {
    event.preventDefault();
    setPredicting(true);
    try {
      const result = await fetchPrediction({
        departure: query.departure,
        destination: query.destination,
        target_time: query.target_time,
        preferences: { priority: query.priority }
      });
      setPrediction(result);
    } finally {
      setPredicting(false);
    }
  }

  async function handleReport(event: FormEvent) {
    event.preventDefault();
    setReportMessage("");
    const result = await submitCrowdsourceReport({
      user_id: "demo-user",
      port: reportPort,
      actual_wait_time: reportWait,
      crowd_level: reportCrowd,
      comment: reportComment
    });
    const [feedData, realtimeData] = await Promise.all([fetchCrowdsourceFeed(), fetchRealtime()]);
    setFeed(feedData.reports);
    setRealtime(realtimeData);
    setReportMessage(`+${result.points_earned} 积分 · ${result.message}`);
  }

  async function handleSubscription(event: FormEvent) {
    event.preventDefault();
    const result = await createSubscription({
      user_id: "demo-user",
      routine: {
        departure: query.departure,
        destination: query.destination,
        days: ["monday", "wednesday", "friday"],
        arrival_deadline: arrivalDeadline,
        priority: query.priority
      },
      alerts: {
        advance_reminder: true,
        anomaly_alert: true,
        better_route_alert: true
      }
    });
    setSubscriptionMessage(`${result.message} 编号：${result.subscription_id}`);
  }

  async function handleBatchPlan() {
    setBatchLoading(true);
    try {
      setBatchPlan(await createBatchPlan());
    } finally {
      setBatchLoading(false);
    }
  }

  if (pageStatus === "loading") {
    return <main className="state-screen"><div className="loader" /><h1>正在载入跨境态势…</h1></main>;
  }

  if (pageStatus === "error" || !realtime) {
    return (
      <main className="state-screen">
        <span className="state-icon">!</span>
        <h1>无法连接 CrossBorder AI 后端</h1>
        <p>请先在 127.0.0.1:8000 启动 FastAPI 服务，然后刷新页面。</p>
      </main>
    );
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#overview">
          <span className="brand-mark">CB</span>
          <span><strong>CrossBorder AI</strong><small>深港跨境智能规划</small></span>
        </a>
        <nav aria-label="主要导航">
          <a href="#overview">口岸态势</a>
          <a href="#planner">路线预测</a>
          <a href="#crowdsource">众包反馈</a>
          <a href="#business">企业方案</a>
        </nav>
        <span className="demo-chip">Deterministic Demo</span>
      </header>

      <section className="hero" id="overview">
        <div className="hero__copy">
          <span className="section-kicker">预测驱动的跨境决策</span>
          <h1>提前看见口岸等待，<br />选择更稳的跨境路线。</h1>
          <p>融合实时口岸状态、未来两小时预测与现场众包反馈，为深港通勤者提供带置信区间和迟到风险的路线建议。</p>
          <div className="hero__actions">
            <a className="button button--primary" href="#planner">立即规划路线</a>
            <span>场景时间：{formatDemoTime(realtime.timestamp)}</span>
          </div>
        </div>
        <div className="hero__signal" aria-label="平台能力摘要">
          <div><strong>4</strong><span>核心口岸</span></div>
          <div><strong>2h</strong><span>等待预测</span></div>
          <div><strong>{feed.length}</strong><span>现场样本</span></div>
          <div><strong>±</strong><span>风险区间</span></div>
        </div>
      </section>

      {realtime.alerts.map((alert) => (
        <div className="service-alert" key={alert.message}>
          <span>天气与交通提示</span>
          <p>{alert.message}</p>
        </div>
      ))}

      <section className="content-section">
        <div className="section-heading">
          <div><span className="section-kicker">Live border pulse</span><h2>四口岸实时态势</h2></div>
          <p>本地 Mock 数据 · 预测会融合演示中的新众包报告</p>
        </div>
        <div className="port-grid">
          {realtime.ports.map((port) => <PortCard port={port} key={port.id} />)}
        </div>
      </section>

      <section className="planner-section" id="planner">
        <div className="planner-panel">
          <div className="section-heading section-heading--stacked">
            <div><span className="section-kicker">AI route planner</span><h2>跨境路线预测</h2></div>
            <p>输入到达时间，系统比较通勤时间、费用与不确定性。</p>
          </div>
          <form className="planner-form" onSubmit={handlePrediction}>
            <label>
              <span>出发地</span>
              <input value={query.departure} onChange={(event) => setQuery({ ...query, departure: event.target.value })} />
            </label>
            <label>
              <span>目的地</span>
              <input value={query.destination} onChange={(event) => setQuery({ ...query, destination: event.target.value })} />
            </label>
            <label>
              <span>最迟到达</span>
              <input type="datetime-local" value={query.target_time} onChange={(event) => setQuery({ ...query, target_time: event.target.value })} />
            </label>
            <label>
              <span>优化偏好</span>
              <select value={query.priority} onChange={(event) => setQuery({ ...query, priority: event.target.value as Priority })}>
                <option value="balanced">稳妥均衡</option>
                <option value="fastest">时间最快</option>
                <option value="cheapest">费用最低</option>
              </select>
            </label>
            <button className="button button--primary" disabled={predicting}>
              {predicting ? "正在计算…" : "生成 AI 建议"}
            </button>
          </form>
        </div>

        {prediction && (
          <div className="prediction-results">
            <div className="recommendation-summary">
              <span>本次推荐</span>
              <h2>{prediction.recommended}口岸</h2>
              <p>{prediction.reason}</p>
              <small>{prediction.demo_notice}</small>
            </div>
            <div className="route-grid">
              {prediction.ports.map((route) => (
                <RouteCard route={route} recommended={route.name === prediction.recommended} key={route.port_id} />
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="community-section" id="crowdsource">
        <div className="community-copy">
          <span className="section-kicker">Human-in-the-loop</span>
          <h2>现场反馈让预测持续校准</h2>
          <p>每一条真实等待时间都会参与演示模型的加权计算。偏差超过5分钟时，系统标记一次模型更新。</p>
          <form className="report-form" onSubmit={handleReport}>
            <div className="form-row">
              <label><span>所在口岸</span>
                <select value={reportPort} onChange={(event) => setReportPort(event.target.value)}>
                  {realtime.ports.map((port) => <option key={port.id}>{port.name}</option>)}
                </select>
              </label>
              <label><span>实际等待</span>
                <div className="unit-input"><input type="number" min="0" max="180" value={reportWait} onChange={(event) => setReportWait(Number(event.target.value))} /><b>分钟</b></div>
              </label>
            </div>
            <label><span>现场人流</span>
              <div className="segmented">
                {(["low", "medium", "high"] as CrowdLevel[]).map((level) => (
                  <button type="button" className={reportCrowd === level ? "active" : ""} onClick={() => setReportCrowd(level)} key={level}>
                    {CROWD_LABELS[level]}
                  </button>
                ))}
              </div>
            </label>
            <label><span>补充说明</span><input value={reportComment} onChange={(event) => setReportComment(event.target.value)} maxLength={160} /></label>
            <button className="button button--accent">提交反馈 · +10积分</button>
            {reportMessage && <p className="success-message">{reportMessage}</p>}
          </form>
        </div>
        <div className="feed-panel">
          <div className="feed-panel__header"><h3>最新现场动态</h3><span>{feed.length} 条展示中</span></div>
          <div className="feed-list">
            {feed.map((report) => <FeedItem report={report} key={report.id} />)}
          </div>
        </div>
      </section>

      <section className="smart-grid">
        <div className="subscription-card">
          <span className="section-kicker">Proactive alert</span>
          <h2>不用反复查询，让最佳路线主动找你</h2>
          <p>每周一、三、五前往深圳时，根据最新预测倒推出发时间，并在异常拥堵时切换路线。</p>
          <form onSubmit={handleSubscription}>
            <label><span>计划到达时间</span><input type="time" value={arrivalDeadline} onChange={(event) => setArrivalDeadline(event.target.value)} /></label>
            <div className="check-list">
              <span>✓ 出发前30分钟提醒</span><span>✓ 异常拥堵预警</span><span>✓ 更优路线提示</span>
            </div>
            <button className="button button--light">设置智能提醒</button>
          </form>
          {subscriptionMessage && <p className="subscription-message">{subscriptionMessage}</p>}
        </div>

        <div className="business-card" id="business">
          <span className="section-kicker">B2B operations</span>
          <h2>企业批量通勤风险管理</h2>
          <p>为跨境巴士、物流团队和企业 HR 批量生成口岸选择、出发时间与迟到风险。</p>
          {!batchPlan ? (
            <button className="button button--dark" onClick={handleBatchPlan} disabled={batchLoading}>
              {batchLoading ? "正在生成…" : "生成4人调度示例"}
            </button>
          ) : (
            <div className="batch-result">
              <div className="batch-stats">
                <div><strong>{batchPlan.summary.employee_count}</strong><span>员工</span></div>
                <div><strong>{batchPlan.summary.avg_commute_time}</strong><span>平均分钟</span></div>
                <div><strong>{batchPlan.summary.high_risk_count}</strong><span>高风险</span></div>
              </div>
              <ul>
                {batchPlan.plan.map((item) => (
                  <li key={item.employee_id}><strong>{item.employee_id}</strong><span>{item.recommended_port} · {item.departure_time} 出发</span></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      <footer>
        <strong>CrossBorder AI</strong>
        <span>SIUS2612 Topic 2 · Local deterministic prototype · No live border data</span>
      </footer>
    </main>
  );
}

export default App;
