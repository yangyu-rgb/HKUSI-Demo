import { type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "../../shared/queryKeys";
import { useScenarios } from "./useScenarios";

vi.mock("./api", () => ({
  fetchScenarios: vi.fn().mockResolvedValue({ start: "2026-07-10", days: 1, scenarios: [], weather_options: [], event_presets: [] }),
  saveScenario: vi.fn().mockResolvedValue({ weather: "rain", is_holiday: false, events: [], date: "2026-07-10", version: "test", is_override: true }),
  restoreScenario: vi.fn().mockResolvedValue({ weather: "clear", is_holiday: false, events: [], date: "2026-07-10", version: "test", is_override: false }),
  resetScenarios: vi.fn().mockResolvedValue({ success: true, scenarios: [] }),
  compareScenarios: vi.fn(),
}));

describe("useScenarios", () => {
  let client: QueryClient;
  let invalidate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    invalidate = vi.spyOn(client, "invalidateQueries").mockResolvedValue();
  });

  function wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }

  async function expectRealtimeInvalidation(run: (result: ReturnType<typeof useScenarios>) => Promise<unknown>) {
    const hook = renderHook(() => useScenarios(), { wrapper });
    await act(async () => { await run(hook.result.current); });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.scenarios });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.realtime });
    hook.unmount();
    invalidate.mockClear();
  }

  it("refreshes realtime data after every persisted scenario change", async () => {
    await expectRealtimeInvalidation((result) => result.save.mutateAsync({
      date: "2026-07-10",
      payload: { weather: "rain", is_holiday: false, events: [] },
    }));
    await expectRealtimeInvalidation((result) => result.restore.mutateAsync("2026-07-10"));
    await expectRealtimeInvalidation((result) => result.reset.mutateAsync());
  });
});
