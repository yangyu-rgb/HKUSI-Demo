import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";


test.beforeEach(async ({ request }) => {
  await request.post("http://127.0.0.1:8000/api/demo/reset");
});


test("V1 双向规划、通知与模型实验室闭环", async ({ page }) => {
  await page.goto("/planner");
  await expect(page.getByRole("heading", { name: "跨境路线预测" })).toBeVisible();
  await page.getByLabel("通勤方向").selectOption("shenzhen_to_hong_kong");
  await page.getByRole("button", { name: "生成 AI 建议" }).click();
  await expect(page.getByText("本次推荐")).toBeVisible();

  await page.goto("/alerts");
  await page.getByRole("button", { name: "运行本地告警周期" }).click();
  await expect(page.getByText("本地告警周期已完成", { exact: false })).toBeVisible();

  await page.goto("/model");
  await expect(page.getByRole("heading", { name: "V1 模型实验室" })).toBeVisible();
  await expect(page.getByText("可完整演示")).toBeVisible();
  await expect(page.getByText("不可训练 V2", { exact: false })).toBeVisible();
});


test("主要页面没有严重可访问性问题", async ({ page }) => {
  for (const route of ["/", "/planner", "/crowdsource", "/alerts", "/business", "/model"]) {
    await page.goto(route);
    await page.locator("main").waitFor();
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(result.violations, `${route}: ${JSON.stringify(result.violations)}`).toEqual([]);
  }
});
