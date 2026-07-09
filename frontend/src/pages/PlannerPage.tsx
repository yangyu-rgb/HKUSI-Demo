import { PlannerForm } from "../features/prediction/PlannerForm";
import { RouteCard } from "../features/prediction/RouteCard";
import { usePrediction } from "../features/prediction/usePrediction";
import { ErrorState, LoadingState } from "../shared/components/PageState";
import styles from "./PlannerPage.module.css";


export function PlannerPage() {
  const {
    locations,
    prediction,
    query,
    setQuery,
    loading,
    predicting,
    error,
    runPrediction,
  } = usePrediction();

  if (loading) {
    return <LoadingState label="正在载入地点与预测矩阵…" />;
  }
  if (!locations) {
    return <ErrorState title="无法载入路线规划" detail={error || "地点数据不可用"} />;
  }

  return (
    <main className="page">
      <section className={styles.planner}>
        <div className={styles.panel}>
          <div className="sectionHeading stacked">
            <div><span className="sectionKicker">AI route planner</span><h1>跨境路线预测</h1></div>
            <p>选择地点和最迟到达时间，系统计算四口岸的最晚出发、预算与准时可达性。</p>
          </div>
          <PlannerForm
            locations={locations}
            query={query}
            setQuery={setQuery}
            predicting={predicting}
            onSubmit={runPrediction}
          />
          {error && <p className="formError">{error}</p>}
        </div>

        {prediction && (
          <div className={styles.results}>
            <div className={styles.summary}>
              <span>本次推荐</span>
              <h2>{prediction.recommended}口岸</h2>
              <p>{prediction.reason}</p>
              <small>{prediction.demo_notice}</small>
            </div>
            {prediction.warnings.map((warning) => (
              <p className={styles.warning} key={warning}>{warning}</p>
            ))}
            <div className={styles.routeGrid}>
              {prediction.ports.map((route) => (
                <RouteCard
                  route={route}
                  recommended={route.port_id === prediction.recommended_port_id}
                  key={route.port_id}
                />
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
