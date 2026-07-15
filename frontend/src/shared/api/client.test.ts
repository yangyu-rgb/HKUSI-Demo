import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, request, userFacingError } from "./client";


afterEach(() => {
  vi.unstubAllGlobals();
});

describe("API client", () => {
  it("preserves backend error codes and request IDs", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: {
        code: "PORT_NOT_FOUND",
        message: "找不到口岸",
        details: { port_id: "missing" },
        request_id: "req-123",
      },
    }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })));

    await expect(request("/api/example")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      code: "PORT_NOT_FOUND",
      requestId: "req-123",
    });
  });

  it("distinguishes network and server failures for users", () => {
    expect(userFacingError(new ApiError("offline", 0, "NETWORK_ERROR")))
      .toBe("Unable to connect to the server. Check that the backend is running.");
    expect(userFacingError(new ApiError("boom", 503, "INTERNAL_ERROR", {}, "req-9")))
      .toBe("The service is temporarily unavailable; contact the Demo operator (request req-9).");
  });

  it("handles successful empty responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    await expect(request<void>("/api/example", { method: "DELETE" })).resolves.toBeUndefined();
  });
});
