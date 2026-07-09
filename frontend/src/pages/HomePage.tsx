import { Link } from "react-router-dom";
import { PortCard } from "../features/realtime/PortCard";
import { useRealtime } from "../features/realtime/useRealtime";
import { ErrorState, LoadingState } from "../shared/components/PageState";
import { formatDemoDateTime } from "../shared/formatters";
import styles from "./HomePage.module.css";


export function HomePage() {
  const { data, loading, error } = useRealtime();

  if (loading) {
    return <LoadingState label="正在载入跨境态势…" />;
  }
  if (error || !data) {
    return <ErrorState title="无法连接 CrossBorder AI 后端" detail={error || "请启动 FastAPI 服务"} />;
  }

  const reportCount = data.ports.reduce((total, port) => total + port.crowdsource_count, 0);
  return (
    <main>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className="sectionKicker">预测驱动的跨境决策</span>
          <h1>提前看见口岸等待，<br />选择更稳的跨境路线。</h1>
          <p>融合实时口岸状态、未来两小时预测与现场众包反馈，为深港通勤者提供带置信区间和迟到风险的路线建议。</p>
          <div className={styles.heroActions}>
            <Link className="button buttonPrimary" to="/planner">立即规划路线</Link>
            <span>场景时间：{formatDemoDateTime(data.timestamp)}</span>
          </div>
        </div>
        <div className={styles.signal} aria-label="平台能力摘要">
          <div><strong>4</strong><span>核心口岸</span></div>
          <div><strong>2h</strong><span>等待预测</span></div>
          <div><strong>{reportCount}</strong><span>现场样本</span></div>
          <div><strong>±</strong><span>风险区间</span></div>
        </div>
      </section>

      {data.alerts.map((alert) => (
        <div className={styles.alert} key={alert.message}>
          <span>天气与交通提示</span>
          <p>{alert.message}</p>
        </div>
      ))}

      <section className="pageSection">
        <div className="sectionHeading">
          <div><span className="sectionKicker">Live border pulse</span><h2>四口岸实时态势</h2></div>
          <p>本地 Mock 数据 · 预测会融合演示中的新众包报告</p>
        </div>
        <div className={styles.portGrid}>
          {data.ports.map((port) => <PortCard port={port} key={port.id} />)}
        </div>
      </section>
    </main>
  );
}
