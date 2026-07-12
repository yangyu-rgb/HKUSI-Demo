# 官方数据源与采集

本阶段只建设 V2 数据准备层，不训练或切换 V2。来源登记位于 `data/sources/official_sources.json`，审批状态只有 `candidate`、`approved_feature_only`、`approved_label` 和 `blocked`。

## 已启用来源

| 来源 | 粒度 | 用途 | 标签资格 |
| --- | --- | --- | --- |
| 香港入境处陆路口岸等候状态（居民） | 每 15 分钟、等级 | 真实拥堵特征与外部校验 | 否 |
| 香港入境处陆路口岸等候状态（访客） | 每 15 分钟、等级 | 真实拥堵特征与外部校验 | 否 |
| 香港入境处每日口岸客流 | 每日、口岸与方向 | 历史客流特征 | 否 |

官方开放数据条款允许在遵守来源确认和署名等条件下复用。等候状态的居民与访客阈值不同，系统分别保存原始状态码和旅客类别，不把等级区间中点解释成实际分钟。

四口岸映射：`LWS → luohu`、`LSC → futian`、`LMC → huanggang`、`SBC → shenzhen-bay`。`arrQueue/Arrival` 表示深圳→香港，`depQueue/Departure` 表示香港→深圳。状态 `4` 和 `99` 仅归档为维护或非服务时间，不作为可用拥堵特征。

## 采集与归档

```bash
# 仓库根目录：推荐的本地 Mac/Linux sidecar
./collector.sh start
./collector.sh status
./collector.sh stop

# 单次采集或只读状态
backend/.venv/bin/python backend/scripts/collect_official_sources.py
backend/.venv/bin/python backend/scripts/collect_official_sources.py --status
```

不带 `--interval` 时执行一次。`start.sh` 默认启动同一采集循环；`collector.sh` 可独立管理。循环每分钟检查一次，但遵循各来源的 `refresh_seconds`，每日客流不会每15分钟重复处理。PID 与日志位于被 Git 忽略的 `data/runtime/`。

原始 JSON/CSV 写入 `data/runtime/external_sources/<source>/<date>/`，SQLite 当前值区保存最新标准化结果，追加式修订区保存来源版本、首次已知时间、观察时间、哈希、口岸、方向、旅客类别、指标类型和值。相同内容保持幂等；已发布值发生修订时追加新版本而不覆盖历史证据。Demo 重置不删除真实来源归档。

## 点时特征与一致性评估

AI v2.1 的训练源由 `backend/scripts/export_public_traffic_snapshot.py` 从治理库导出为规范化日级快照；快照保存来源版本、原始哈希和首次已知时间。场景数据和模型二进制均在运行时重建，不把本机数据库当作可复现训练输入。

正式预测按 `forecast_run.generated_at` 查询当时已经抓取且已经观察到的官方特征。AI v2.1 以最近56天客流中位数建立常态、最近8个相同星期建立目标日预期客流；居民/访客等级超过30分钟或目标超过三小时即不再校准。所有来源版本、压力和权重冻结到预测依据，后续修订不会产生未来信息泄漏。

V2 readiness 还把 V1 统计等待映射到居民/访客各自的官方阈值，仅计算等级命中率、平均序数误差、混淆矩阵及口岸/方向/旅客/小时切片。该报告不把等级区间转成分钟，不计算分钟 MAE，也不增加训练标签数。

## 精确分钟标签

```bash
cd backend
.venv/bin/python scripts/validate_exact_wait_labels.py candidate.csv
```

输入至少包含 `record_id`、`source_id`、`source_version`、`approval_batch_id`、`port_id`、`direction`、`wait_started_at`、`wait_ended_at` 和 `actual_wait_minutes`。只有来源已登记为 `approved_label`、时间带时区且分钟数与等待区间一致时才通过。当前没有 `approved_label` 来源，因此该工具默认会拒绝所有外部分钟文件；它不会写入数据库。

## 候选与阻断来源

- 深圳开放数据平台的分口岸旅客数据仍需核验接口、字段粒度、历史范围和许可，状态为 `candidate`。
- i口岸尚无可用于本项目的书面授权和接口语义，状态为 `blocked`，不得通过网页抓取绕过审批。

参考：香港 [开放数据使用条款](https://data.gov.hk/sc/terms-and-conditions)、[陆路口岸等候状态](https://data.gov.hk/sc-data/dataset/hk-immd-set28-land-boundary-control-points-waiting-time)、[每日客流](https://data.gov.hk/sc-data/dataset/hk-immd-set5-statistics-daily-passenger-traffic)；深圳口岸办 [版权保护声明](https://ka.sz.gov.cn/bqbh/content/post_2289093.html)。
