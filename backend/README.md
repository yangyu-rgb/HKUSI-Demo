# CrossBorder AI 后端

用于 CrossBorder AI 确定性本地 Demo 的 FastAPI 服务。

## 架构

```text
app/
  api/           # HTTP 路由和依赖提供器
  schemas/       # Pydantic 请求、响应契约和枚举
  services/      # 预测与业务流程逻辑
  repositories/ # 缓存的 JSON 输入和 SQLite 动态持久化
  main.py        # 应用组装、中间件和错误映射
```

静态场景输入保存在 `data/`。众包反馈、订阅和企业方案历史保存在被 Git 忽略的 `data/runtime/crossborder.db`。调用 `POST /api/demo/reset` 可以恢复确定性种子状态。

预测器融合插值后的口岸趋势、相似历史样本和可用的近期众包等待时间。置信区间使用历史波动率和预测斜率计算；`app/config.py` 中的命名常量保证 Demo 模型可解释、可审查。

## 运行

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

启动后可通过 `http://127.0.0.1:8000/docs` 查看交互式 API 文档。

## 验证

```bash
pip install -r requirements-dev.txt
pytest -q
python scripts/export_openapi.py
```

测试使用隔离的临时 SQLite 数据库，不会修改 Demo 运行数据库。
