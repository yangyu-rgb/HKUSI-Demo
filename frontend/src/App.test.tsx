import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "./App";


const locations = {
  origins: [
    { id: "hku", name: "香港大学", city: "香港" },
    { id: "central", name: "中环", city: "香港" },
  ],
  destinations: [
    { id: "nanshan-tech", name: "深圳南山科技园", city: "深圳" },
  ],
};

const prediction = {
  query: {
    origin_id: "hku",
    origin_name: "香港大学",
    destination_id: "nanshan-tech",
    destination_name: "深圳南山科技园",
    target_time: "2026-07-09T09:30:00",
    priority: "balanced",
    max_budget: 100,
  },
  ports: [
    {
      port_id: "futian",
      name: "福田",
      name_en: "Futian",
      predicted_wait_time: 18,
      confidence_interval: [14, 22],
      risk_level: "low",
      late_risk_percent: 12,
      total_time: 84,
      total_cost: 49,
      estimated_arrival: "2026-07-09T09:09:00",
      latest_departure: "2026-07-09T07:56:00",
      buffer_minutes: 21,
      on_time: true,
      within_budget: true,
      crowdsource_enhanced: true,
      crowdsource_count: 1,
      route: {
        steps: [
          { mode: "mtr", label: "香港大学 → 福田", duration: 39, cost: 43 },
          { mode: "border", label: "福田口岸通关", duration: 18, cost: 0 },
          { mode: "metro", label: "福田 → 深圳南山科技园", duration: 27, cost: 6 },
        ],
      },
      anomalies: [],
    },
  ],
  recommended: "福田",
  recommended_port_id: "futian",
  reason: "福田在当前偏好下综合最优。",
  warnings: [],
  generated_at: "2026-07-09T07:45:00",
  demo_notice: "本地确定性演示。",
};


function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}


afterEach(() => {
  vi.unstubAllGlobals();
});


describe("application routes", () => {
  it("renders a feature page directly", () => {
    renderRoute("/business");
    expect(screen.getByRole("heading", { name: "企业批量通勤风险管理" })).toBeInTheDocument();
  });

  it("loads locations and submits a prediction query", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      const payload = url.endsWith("/api/locations") ? locations : prediction;
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderRoute("/planner");
    await screen.findByText("本次推荐");

    fireEvent.change(screen.getByLabelText("出发地"), { target: { value: "central" } });
    fireEvent.click(screen.getByRole("button", { name: "生成 AI 建议" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const requestInit = fetchMock.mock.calls[2][1] as RequestInit;
    expect(JSON.parse(String(requestInit.body)).origin_id).toBe("central");
  });

  it("shows a useful planner error when bootstrap fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    renderRoute("/planner");

    expect(await screen.findByRole("heading", { name: "无法载入路线规划" })).toBeInTheDocument();
    expect(screen.getByText("offline")).toBeInTheDocument();
  });
});
