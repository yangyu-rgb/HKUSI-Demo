# 官方数据源与采集

本项目只使用可复现的课堂官方快照。来源登记位于 `data/sources/official_sources.json`；不建设真实分钟标签或生产采集流程。

## 已启用来源

| 来源 | 粒度 | 用途 | 标签资格 |
| --- | --- | --- | --- |
| 香港入境处陆路口岸等候状态（居民） | 每 15 分钟、等级 | 真实拥堵特征与外部校验 | 否 |
| 香港入境处陆路口岸等候状态（访客） | 每 15 分钟、等级 | 真实拥堵特征与外部校验 | 否 |
| 香港入境处每日口岸客流 | 每日、口岸与方向 | 历史客流特征 | 否 |
| 深圳市口岸办公布的分口岸统计/预测快照 | 公布周期、口岸 | 跨来源一致性与区间核验 | 否 |

官方开放数据条款允许在遵守来源确认和署名等条件下复用。等候状态的居民与访客阈值不同，系统分别保存原始状态码和旅客类别，不把等级区间中点解释成实际分钟。

四口岸映射：`LWS → luohu`、`LSC → futian`、`LMC → huanggang`、`SBC → shenzhen-bay`。`arrQueue/Arrival` 表示深圳→香港，`depQueue/Departure` 表示香港→深圳。状态 `4` 和 `99` 仅归档为维护或非服务时间，不作为可用拥堵特征。

深圳快照位于 `data/history/shenzhen_port_reference.json`，保存发布日期、指标类型、来源网址和口岸数值。它与香港压力分别标准化，只用于一致度和不确定性，不参与客流求和或点预测。

## 可选维护采集

```bash
# 仓库根目录：推荐的本地 Mac/Linux sidecar
./collector.sh start
./collector.sh status
./collector.sh stop

# 单次采集或只读状态
backend/.venv/bin/python backend/scripts/collect_official_sources.py
backend/.venv/bin/python backend/scripts/collect_official_sources.py --status
```

这些命令只供维护者手动刷新香港缓存；`start.sh` 不再启动采集器，课堂演示不依赖网络。

原始 JSON/CSV 写入 `data/runtime/external_sources/<source>/<date>/`，SQLite 当前值区保存最新标准化结果，追加式修订区保存来源版本、首次已知时间、观察时间、哈希、口岸、方向、旅客类别、指标类型和值。相同内容保持幂等；已发布值发生修订时追加新版本而不覆盖历史证据。Demo 重置不删除真实来源归档。

## 点时特征与一致性评估

AI v2.2 的训练源由 `backend/scripts/export_public_traffic_snapshot.py` 导出为规范化日级快照；快照保存来源版本、原始哈希和首次已知时间。基础数据和模型二进制均在运行时重建。

AI v2.2 以最近56天客流中位数建立常态、最近8个相同星期建立目标日预期客流；居民/访客等级超过30分钟或目标超过三小时即不再校准。所有来源版本、压力和权重写入预测依据。

课堂模型不把官方等级区间转换成真实分钟，也不计算现场分钟 MAE。

## 已退役与阻断来源

- 现场精确分钟标签、准入校验和训练快照不属于课堂 Demo 运行流程。
- 深圳市口岸办公开统计快照已用于核验；不自动抓取网页更新。
- i口岸尚无可用于本项目的书面授权和接口语义，状态为 `blocked`，不得通过网页抓取绕过审批。

参考：香港 [开放数据使用条款](https://data.gov.hk/sc/terms-and-conditions)、[陆路口岸等候状态](https://data.gov.hk/sc-data/dataset/hk-immd-set28-land-boundary-control-points-waiting-time)、[每日客流](https://data.gov.hk/sc-data/dataset/hk-immd-set5-statistics-daily-passenger-traffic)；深圳口岸办 [版权保护声明](https://ka.sz.gov.cn/bqbh/content/post_2289093.html)。
