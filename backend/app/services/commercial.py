from datetime import timedelta

from ..clock import Clock, as_hong_kong
from ..exceptions import DomainValidationError
from ..repositories import DemoRepository
from ..schemas.commercial import CommercialCheckoutRequest


PLANS = [
    {
        "id": "starter", "name": "Starter", "audience": "个人通勤者",
        "monthly_price_hkd": 0, "yearly_price_hkd": 0,
        "description": "体验口岸态势、路线预测和基础提醒。",
        "features": ["四口岸未来趋势", "每月20次路线预测", "1条通勤提醒"],
        "highlighted": False,
    },
    {
        "id": "professional", "name": "Professional", "audience": "跨境团队与中小企业",
        "monthly_price_hkd": 399, "yearly_price_hkd": 3990,
        "description": "把预测、批量调度和运营指标用于日常决策。",
        "features": ["不限路线预测", "100人批量调度", "运营分析与CSV导出", "优先异常提醒"],
        "highlighted": True,
    },
    {
        "id": "enterprise", "name": "Enterprise", "audience": "巴士、物流与园区客户",
        "monthly_price_hkd": 1999, "yearly_price_hkd": 19990,
        "description": "面向组织隔离、API能力和白标评估的商业展示方案。",
        "features": ["多组织调度展示", "API用量与SLA展示", "运营大屏路线图", "白标与数据服务评估"],
        "highlighted": False,
    },
]


class CommercialService:
    def __init__(self, repository: DemoRepository, clock: Clock):
        self._repository = repository
        self._clock = clock

    @staticmethod
    def get_plans() -> dict:
        return {"plans": PLANS, "demo_notice": "本地商业化演示，不连接支付网关，也不会产生真实扣款。"}

    @staticmethod
    def _account_id(persona: dict) -> str:
        return persona["organization_id"] if persona["organization_id"] != "personal" else persona["id"]

    def get_subscription(self, persona: dict) -> dict:
        item = self._repository.get_commercial_subscription(self._account_id(persona))
        if item:
            item["plan_name"] = next(plan["name"] for plan in PLANS if plan["id"] == item["plan_id"])
            item["demo_payment"] = True
        return {"subscription": item, "demo_notice": "订阅与收据只保存在本地 SQLite，用于课堂商业展示。"}

    def checkout(self, request: CommercialCheckoutRequest, persona: dict) -> dict:
        plan = next((item for item in PLANS if item["id"] == request.plan_id), None)
        if plan is None:
            raise DomainValidationError("不支持该商业套餐")
        now = as_hong_kong(self._clock.now()).replace(microsecond=0)
        price = plan["monthly_price_hkd"] if request.billing_cycle == "monthly" else plan["yearly_price_hkd"]
        subscription = self._repository.save_commercial_subscription(
            account_id=self._account_id(persona), persona=persona,
            plan_id=plan["id"], billing_cycle=request.billing_cycle,
            price_hkd=price, started_at=now,
            renews_at=now + timedelta(days=30 if request.billing_cycle == "monthly" else 365),
        )
        subscription.update({"plan_name": plan["name"], "demo_payment": True})
        return {
            "success": True, "subscription": subscription,
            "message": f"已完成 {plan['name']} 套餐的本地模拟结账；未产生真实扣款。",
        }

    def cancel(self, persona: dict) -> dict:
        item = self._repository.cancel_commercial_subscription(self._account_id(persona))
        if item is None:
            raise DomainValidationError("当前没有可取消的商业订阅")
        item["plan_name"] = next(plan["name"] for plan in PLANS if plan["id"] == item["plan_id"])
        item["demo_payment"] = True
        return {"subscription": item, "demo_notice": "订阅已在本地 Demo 中取消，不涉及真实退款。"}

