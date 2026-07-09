# CrossBorder AI 项目规划

## 一、项目定位与功能分层

### 基础功能层（必备）
**1. 实时信息聚合展示**
- 接入i口岸API或官方数据源，实时显示4个口岸当前等待时间
- 显示各口岸开放状态、特殊通道信息
- 交通实时状况（港铁、高铁、巴士延误信息）
- 天气、汇率、通关政策变化

### 核心差异化层（AI驱动）
**2. AI预测引擎**
- 未来1-3小时口岸等待时间预测
- 置信区间和风险量化
- 多模式路线优化（港铁+罗湖 vs 高铁+福田等）

**3. 众包智能反馈系统**（创新点✨）
- 用户可实时报告"我现在在罗湖，实际等了15分钟"
- 系统根据众包数据动态校准预测模型
- 显示"23分钟前有用户报告：福田排队人少"
- 激励机制：报告数据获得积分/VIP功能
- **AI亮点**：使用在线学习（Online Learning）算法，让模型根据实时反馈自适应更新

**4. 智能提醒订阅**（创新点✨）
- AI学习用户的通勤模式（每周三上午去深圳、偏好最快路线）
- 主动推送："根据当前预测，建议你在8:15出发走福田口岸"
- 异常主动提醒："你常走的罗湖今天异常拥堵+40%"
- 可设置"到达deadline"，系统倒推最晚出发时间
- **AI亮点**：个性化推荐引擎 + 时间序列异常检测

### 商业化功能层（B2B）
**5. 企业批量调度Dashboard**
- 物流公司、跨境巴士公司批量规划
- 员工通勤风险管理

---

## 二、与竞品的核心差异

| 功能 | Google Maps | i口岸 | CrossBorder AI |
|------|-------------|-------|----------------|
| 路线导航 | ✅ | ❌ | ✅ |
| **实时口岸状态** | ❌ | ✅ | ✅ 基础功能 |
| **未来预测（1-3h）** | ❌ | ❌ | ✅ 核心 |
| **众包实时校准** | ❌ | ❌ | ✅ 创新点 |
| **智能提醒订阅** | ❌ | ❌ | ✅ 创新点 |
| **多模式优化** | 部分 | ❌ | ✅ 核心 |
| **风险量化** | ❌ | ❌ | ✅ 核心 |
| **企业批量规划** | ❌ | ❌ | ✅ B2B |

### 核心竞争力总结
- **i口岸**：只看"现在"，被动查询
- **Google Maps**：通用导航，不懂跨境特殊性
- **CrossBorder AI**：看"未来" + 众包增强 + 主动推送 + 跨境专属优化

---

## 三、技术架构

### 1. 前端架构（React + TypeScript）

```
frontend/
├── src/
│   ├── pages/
│   │   ├── Home.tsx                    # 首页：实时状态 + 输入查询
│   │   ├── Prediction.tsx              # 预测结果页
│   │   ├── Crowdsource.tsx             # 众包反馈页面
│   │   ├── Subscription.tsx            # 智能提醒设置
│   │   ├── Dashboard.tsx               # 企业Dashboard
│   │   └── History.tsx                 # 个人历史记录
│   ├── components/
│   │   ├── RealTimeBoard.tsx           # 实时看板（4个口岸状态）
│   │   ├── PredictionChart.tsx         # 预测折线图 + 置信区间
│   │   ├── CrowdsourceFeed.tsx         # 众包反馈流
│   │   ├── CrowdsourceReport.tsx       # 用户报告组件（"我正在罗湖"）
│   │   ├── SmartAlert.tsx              # 智能提醒卡片
│   │   ├── RiskIndicator.tsx           # 风险可视化
│   │   ├── RouteComparison.tsx         # 路线对比
│   │   └── SubscriptionConfig.tsx      # 提醒订阅配置
│   ├── services/
│   │   ├── api.ts                      # 后端API
│   │   └── realtime.ts                 # 实时数据轮询/WebSocket
│   └── types/
│       └── index.ts
```

#### 关键UI设计

**首页实时看板：**
```
罗湖 🟢        福田 🟡        皇岗 🔴        深圳湾 🟢
当前: 15分钟   当前: 25分钟   当前: 45分钟   当前: 12分钟
预测9:30: 18分  预测9:30: 20分  预测9:30: 50分  预测9:30: 15分

[众包反馈] 5分钟前 @user123: 福田人很少，快速通过 👍
```

**众包反馈组件：**
```
你现在在哪个口岸？ [罗湖 ▼]
实际等待时间？   [15] 分钟
人流情况？       [😊 人少] [😐 正常] [😱 爆满]
[提交反馈 +10积分]
```

**智能提醒设置：**
```
📍 常用路线：香港大学 → 深圳南山
⏰ 通勤时间：每周一、三、五 上午9:00前到达
🎯 偏好策略：最快路线优先

[✓] 出发前30分钟提醒最优路线
[✓] 检测到异常拥堵时提前通知
[✓] 发现更优路线时推送
```

### 2. 后端架构（FastAPI）

```
backend/
├── app/
│   ├── main.py                         # FastAPI入口
│   ├── models/
│   │   ├── prediction.py               # 时间序列预测模型
│   │   ├── online_learning.py          # 在线学习模块（众包数据更新）
│   │   ├── optimization.py             # 路线优化
│   │   ├── anomaly.py                  # 异常检测
│   │   └── personalization.py          # 个性化推荐引擎
│   ├── api/
│   │   ├── realtime.py                 # GET /api/realtime - 实时状态
│   │   ├── predict.py                  # POST /api/predict - 预测
│   │   ├── crowdsource.py              # POST /api/crowdsource/report - 用户反馈
│   │   │                               # GET /api/crowdsource/feed - 反馈流
│   │   ├── subscription.py             # POST /api/subscription - 订阅管理
│   │   ├── routes.py                   # POST /api/routes - 路线推荐
│   │   └── batch.py                    # POST /api/batch - 企业批量
│   ├── data/
│   │   ├── realtime_fetcher.py         # 实时数据获取（i口岸API/爬虫）
│   │   └── loader.py                   # 历史数据加载
│   └── schemas/
│       └── request.py
```

#### 关键API设计

**GET `/api/realtime`** - 实时获取4个口岸当前状态（基础功能）

Response:
```json
{
  "timestamp": "2026-07-09T08:45:00",
  "ports": [
    {
      "name": "罗湖",
      "current_wait": 15,
      "status": "open",
      "crowd_level": "medium",
      "special_channels": ["团队通道开放"],
      "crowdsource_count": 12,
      "last_report": {
        "time": "5分钟前",
        "user": "user123",
        "feedback": "人流正常，快速通过"
      }
    }
  ],
  "alerts": [
    {
      "type": "weather",
      "message": "今日深圳有雷暴预警",
      "severity": "medium"
    }
  ]
}
```

**POST `/api/crowdsource/report`** - 用户提交实时反馈（创新功能）

Request:
```json
{
  "user_id": "user123",
  "port": "罗湖",
  "actual_wait_time": 15,
  "crowd_level": "medium",
  "timestamp": "2026-07-09T08:45:00",
  "comment": "人流正常，快速通过"
}
```

Response:
```json
{
  "success": true,
  "points_earned": 10,
  "model_updated": true,
  "message": "感谢反馈！你的数据帮助我们优化了预测模型"
}
```

**POST `/api/subscription`** - 智能提醒订阅（创新功能）

Request:
```json
{
  "user_id": "user123",
  "routine": {
    "departure": "香港大学",
    "destination": "深圳南山",
    "days": ["monday", "wednesday", "friday"],
    "arrival_deadline": "09:00",
    "priority": "fastest"
  },
  "alerts": {
    "advance_reminder": true,
    "anomaly_alert": true,
    "better_route_alert": true
  }
}
```

Response:
```json
{
  "subscription_id": "sub_123",
  "next_alert": "2026-07-10T07:45:00",
  "message": "已设置！我们会在出发前30分钟推送最优路线"
}
```

**POST `/api/predict`** - 口岸等待预测

Request:
```json
{
  "departure": "香港大学",
  "destination": "深圳南山科技园",
  "target_time": "2026-07-10T09:30:00",
  "preferences": {
    "priority": "fastest",
    "max_budget": 100
  }
}
```

Response:
```json
{
  "ports": [
    {
      "name": "罗湖",
      "predicted_wait_time": 25,
      "confidence_interval": [18, 35],
      "risk_level": "medium",
      "total_time": 85,
      "total_cost": 45,
      "crowdsource_enhanced": true,
      "route": {
        "steps": [
          {"mode": "mtr", "from": "香港大学", "to": "罗湖", "duration": 45, "cost": 30},
          {"mode": "walk", "from": "罗湖", "to": "罗湖口岸", "duration": 5, "cost": 0},
          {"mode": "border", "from": "罗湖口岸", "to": "罗湖口岸(中国)", "duration": 25, "cost": 0},
          {"mode": "metro", "from": "罗湖站", "to": "南山", "duration": 30, "cost": 15}
        ]
      },
      "anomalies": []
    },
    {
      "name": "福田",
      "predicted_wait_time": 15,
      "confidence_interval": [12, 20],
      "risk_level": "low",
      "total_time": 68,
      "total_cost": 120
    }
  ],
  "recommended": "福田",
  "reason": "虽然高铁票价较高，但口岸等待最短，总时间节省20分钟"
}
```

**POST `/api/batch`** - B2B企业功能

Request:
```json
{
  "company": "某跨境物流公司",
  "employees": [
    {"id": 1, "departure": "香港", "arrival_deadline": "09:00"},
    {"id": 2, "departure": "香港", "arrival_deadline": "09:30"}
  ],
  "date": "2026-07-15"
}
```

Response:
```json
{
  "plan": [
    {"employee_id": 1, "recommended_port": "福田", "departure_time": "07:45"},
    {"employee_id": 2, "recommended_port": "罗湖", "departure_time": "08:00"}
  ],
  "summary": {
    "avg_commute_time": 75,
    "cost_saved": 15,
    "risk_analysis": "3人存在迟到风险>20%"
  }
}
```

### 3. 数据层

```
data/
├── realtime/
│   └── ports_status.json               # 实时状态缓存（每分钟更新）
├── history/
│   ├── luohu_history.csv               # 罗湖历史数据
│   ├── futian_history.csv
│   ├── huanggang_history.csv
│   └── shenzhenwan_history.csv
├── crowdsource/
│   └── user_reports.json               # 众包反馈数据库（Mock用JSON）
├── factors/
│   ├── weather.json
│   ├── holidays.json
│   └── events.json
└── subscriptions/
    └── user_subscriptions.json         # 用户订阅配置
```

#### 数据来源策略

**实时数据：**
- 优先：接入i口岸官方API（如果可获取）
- 备选：爬虫抓取公开数据
- Demo：Mock数据 + 随机波动模拟真实感

**历史数据：**
- 使用香港入境处公开统计数据
- 使用交通部门公开的客流数据
- 合理假设+插值生成训练数据

**众包数据：**
- Demo阶段：预先准备一些假的用户反馈
- 演示时可现场演示提交反馈，立即在feed中显示

---

## 四、AI技术实现（Demo可行方案）

### 1. 时间序列预测（核心功能）

**技术栈（Demo版）：**
- 使用简单的规则引擎 + 历史平均值
- 考虑因素：小时、星期、节假日、天气

```python
def predict_wait_time(port: str, target_time: datetime, crowdsource_data: list) -> dict:
    # 基础预测：历史平均值
    base = get_historical_average(port, target_time.hour, target_time.weekday())
    
    # 因素调整
    if is_holiday(target_time):
        base *= 1.5
    if is_rush_hour(target_time.hour):
        base *= 1.4
    if is_rainy(target_time):
        base *= 1.2
    
    # 众包数据校准（创新点）
    recent_reports = get_recent_crowdsource(port, minutes=30)
    if recent_reports:
        crowd_avg = mean([r.actual_wait_time for r in recent_reports])
        # 加权融合：70%历史预测 + 30%众包实时
        base = base * 0.7 + crowd_avg * 0.3
    
    # 生成置信区间
    confidence_lower = base * 0.75
    confidence_upper = base * 1.25
    
    return {
        "predicted_wait_time": int(base),
        "confidence_interval": [int(confidence_lower), int(confidence_upper)],
        "risk_level": calculate_risk(base, confidence_upper - confidence_lower),
        "crowdsource_enhanced": len(recent_reports) > 0
    }
```

**Pitch时的技术升级说明：**
"在实际部署中，我们会使用LSTM/Prophet等时间序列模型，并结合众包数据进行在线学习（Online Learning），让预测精度随着用户反馈不断提升。"

### 2. 众包在线学习（创新点）

```python
def update_model_with_crowdsource(report: CrowdsourceReport):
    """
    根据用户实时反馈，动态更新预测模型
    """
    # 计算预测误差
    predicted = get_last_prediction(report.port, report.timestamp)
    error = report.actual_wait_time - predicted
    
    # 在线更新（Demo用简单加权平均）
    if abs(error) > 5:  # 误差>5分钟才更新
        update_adjustment_factor(report.port, report.timestamp, error)
        log_model_update(report)
    
    return {"model_updated": abs(error) > 5}
```

### 3. 智能提醒引擎（创新点）

```python
def generate_smart_alert(user_subscription: Subscription) -> Alert | None:
    """
    根据用户订阅，生成智能提醒
    """
    now = datetime.now()
    target_arrival = user_subscription.arrival_deadline
    
    # 预测所有口岸未来情况
    predictions = predict_all_ports(target_arrival)
    best_route = optimize_route(predictions, user_subscription.priority)
    
    # 计算最佳出发时间
    optimal_departure = target_arrival - timedelta(minutes=best_route.total_time + 10)
    
    # 检查是否需要提醒
    if now >= optimal_departure - timedelta(minutes=30) and now < optimal_departure:
        return Alert(
            type="departure_reminder",
            message=f"建议你在{optimal_departure.strftime('%H:%M')}出发，走{best_route.port}口岸",
            route=best_route
        )
    
    # 异常检测
    if detect_anomaly(best_route.port):
        alternative = find_alternative_route(predictions, best_route.port)
        return Alert(
            type="anomaly_alert",
            message=f"⚠️ {best_route.port}今日异常拥堵，建议改走{alternative.port}",
            route=alternative
        )
    
    return None
```

---

## 五、演示场景设计

### 场景1：个人用户 - 实时查询 + 众包
**用户：** 跨境学生小明

1. **打开首页看实时状态**
   - 看到4个口岸当前等待时间
   - 看到众包反馈："5分钟前 @user123: 福田人很少"

2. **查询未来预测**
   - 输入：9:30到达深圳南山
   - AI推荐：福田口岸，预测等待15分钟（置信区间12-20）
   - 显示："本预测已融合23条用户实时反馈"

3. **实际通关后提交反馈**
   - 小明到达福田后，打开App
   - 提交："实际等了12分钟，人流正常"
   - 系统显示："+10积分，感谢反馈！"

4. **设置智能提醒**
   - 小明设置：每周一三五上午9:00前到达
   - 系统承诺：提前30分钟推送最优路线

### 场景2：智能提醒触发
**用户：** 已订阅的小明

1. **周三早上7:45**
   - 小明收到推送："根据当前预测，建议8:15出发走福田口岸"
   - 显示预测图表和路线详情

2. **周五早上检测到异常**
   - 7:30推送："⚠️ 你常走的罗湖今天异常拥堵+40%，建议改走深圳湾"
   - 一键切换路线

### 场景3：企业批量调度
**用户：** 跨境物流公司HR

1. 上传20名员工通勤需求
2. 系统批量预测并生成调度方案
3. Dashboard显示风险员工和优化建议

---

## 六、开发计划

### Phase 1: MVP核心功能（7月9-12日）

**前端（优先级）：**
- [ ] 首页实时看板（4个口岸状态）
- [ ] 预测结果页（图表+置信区间）
- [ ] 众包反馈组件（报告+feed展示）
- [ ] 智能提醒设置页

**后端：**
- [ ] `/api/realtime` - 实时状态（Mock）
- [ ] `/api/predict` - 预测引擎
- [ ] `/api/crowdsource/report` - 接收反馈
- [ ] `/api/crowdsource/feed` - 反馈流
- [ ] `/api/subscription` - 订阅管理

**数据：**
- [ ] Mock实时数据（每分钟随机波动）
- [ ] 历史数据CSV（4个口岸）
- [ ] 预先准备的众包反馈样本

### Phase 2: 完善与优化（7月13-14日）
- [ ] 路线对比优化
- [ ] 企业Dashboard（B2B场景）
- [ ] UI动画和交互
- [ ] 响应式设计

### Phase 3: Pitch准备（7月14-15日）
- [ ] 英文PPT制作
- [ ] Demo视频录制
- [ ] 商业模式和数据准备

---

## 七、技术栈

| 层级 | 技术选型 | 理由 |
|------|----------|------|
| 前端框架 | React 18 + TypeScript | 类型安全，快速开发 |
| 构建工具 | Vite | 快速热更新 |
| UI库 | Ant Design / Chakra UI | 组件丰富，快速原型 |
| 图表库 | Recharts | 预测折线图、置信区间 |
| 实时通信 | 轮询 / WebSocket（可选） | 实时数据更新 |
| 后端框架 | FastAPI (Python 3.10+) | 高性能，类型验证 |
| 数据验证 | Pydantic | 结构化数据 |
| Mock数据 | JSON + CSV | 无需数据库 |

---

## 八、竞争力总结

### 为什么不被Google Maps替代？
1. **跨境专属场景**：口岸等待时间是Google Maps不感知的
2. **预测而非实时**：看未来1-3小时，而非只看当前
3. **众包增强**：用户数据让预测越来越准
4. **主动服务**：智能提醒，不需要每次手动查

### 为什么不被i口岸替代？
1. **i口岸只有实时**：我们有预测+优化
2. **i口岸只是信息展示**：我们有路线规划和决策支持
3. **i口岸是被动查询**：我们有主动提醒订阅

### AI核心差异化
- **时间序列预测** → 看未来
- **在线学习（众包数据）** → 越用越准
- **个性化推荐** → 懂你的习惯
- **异常检测** → 主动预警

---

## 九、风险与应对

| 风险 | 应对策略 |
|------|----------|
| 无法获取i口岸API | 爬虫 + Mock数据 + "Demo原型"定位 |
| 众包数据冷启动 | 预先准备假用户反馈，演示阶段现场模拟 |
| 预测准确度质疑 | 强调"决策支持工具"，展示置信区间 |
| Google Maps竞争 | 强调跨境专属+预测+众包三大差异 |
| 商业模式不清晰 | 主推B2B SaaS + 数据API |

---

## 十、评分标准对应（Topic 2）

### 1. Innovative AI Business Concept (50%)

**Originality & Value (15%)**
- ✅ 跨境场景的预测+众包+智能提醒是新颖组合
- ✅ 明确解决"口岸等待不确定"的痛点

**AI Technology at Core (20%)**
- ✅ 时间序列预测（Time-Series Forecasting）
- ✅ 概率预测（Probabilistic Prediction）
- ✅ 在线学习（Online Learning with Crowdsourced Data）
- ✅ 路线优化（Route Optimization）
- ✅ 异常检测（Anomaly Detection）
- ✅ 个性化推荐（Personalization Engine）

**Problem-Solution Fit (15%)**
- ✅ 每天70万人次跨境，刚需市场
- ✅ B2B模式有明确付费能力

### 2. Business Viability (30%)

**Feasibility & Scalability (15%)**
- ✅ 技术可行（基于现有数据+模型）
- ✅ 可扩展（先深港，后珠港澳、京津冀）

**Entrepreneurial Vision (15%)**
- ✅ B2B SaaS清晰商业模式
- ✅ 数据API潜在盈利点
- ✅ 政府合作机会

### 3. Effectiveness of Presentation (20%)

**Organization & Coherence (10%)**
- ✅ Demo流程清晰（实时→预测→众包→智能提醒）

**Presentation Skills (10%)**
- ✅ 数据可视化吸引眼球
- ✅ 实时Demo增强说服力
- ✅ 现场演示众包反馈互动性强

---

## 十一、下一步行动

1. ✅ 项目规划确认
2. 🔄 更新README.md
3. 📂 准备数据文件结构
4. 💻 开始前端开发（实时看板优先）
5. 🔧 开始后端API（实时+预测API优先）
6. 🎨 UI/UX设计细化
7. 📊 准备Demo数据和场景
