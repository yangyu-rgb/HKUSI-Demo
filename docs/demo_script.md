# CrossBorder AI Demo Script

Target duration: 3–4 minutes.

## Opening — 20 seconds

“普通地图能规划交通，却看不到未来口岸排队的不确定性。CrossBorder AI 将口岸等待预测、众包校准和主动提醒放进同一个跨境决策流程。”

State clearly that the prototype uses deterministic local data and does not represent live border conditions.

## Scene 1: Border Pulse — 30 seconds

1. Open `/`.
2. Compare the four port cards and their two-hour wait forecasts.
3. Point out the 07:45 scenario time and weather/transport buffer alert.

Key message: the product shows where congestion is heading, not only where it is now.

## Scene 2: Route Decision — 80 seconds

1. Open `/planner`.
2. Select 香港大学 → 深圳南山科技园, arrival by 09:30, HK$100 budget.
3. Keep “稳妥均衡” and generate the recommendation.
4. Show the recommended port, latest departure, estimated arrival, buffer, cost, confidence interval, and risk.
5. Change the origin to 九龙塘 or destination to 深圳福田 CBD and rerun.
6. Explain that the route times and recommendation change because the locations use a real deterministic matrix rather than decorative text.
7. Optionally reduce the budget to show the budget warning.

Key message: the system answers “when must I leave, can I still arrive on time, and which uncertainty is acceptable?”

## Scene 3: Crowdsource Calibration — 40 seconds

1. Open `/crowdsource`.
2. Submit a 12-minute 福田 report with “畅通”.
3. Show the +10 points message and new feed item.
4. Return to `/planner` and rerun the same prediction.
5. Show the increased crowdsource count.

Key message: user feedback closes the prediction loop.

## Scene 4: Proactive and B2B Value — 40 seconds

1. Open `/alerts` and create the 09:30 reminder.
2. Explain the planned departure, anomaly, and better-route triggers.
3. Open `/business` and generate the four-person dispatch example.
4. Point out employee count, average commute, risk count, and individual departure times.

Key message: the same prediction service supports individuals and enterprise scheduling.

## Closing — 20 seconds

“CrossBorder AI 的商业重点不是向个人用户收导航费，而是把跨境等待风险转化为巴士、物流和企业 HR 可执行的调度服务。”

## Backup

- 60–90 second screen recording
- One screenshot per route page
- One architecture slide: JSON repositories → services → API routers → feature pages
- Static API responses in case a local server fails
