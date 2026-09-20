// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../api/keepalive";

const { createClient, query, from, select, limit } = vi.hoisted(() => ({
  createClient: vi.fn(),
  query: vi.fn(),
  from: vi.fn(),
  select: vi.fn(),
  limit: vi.fn(),
}));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

function response() {
  return { status: vi.fn().mockReturnThis(), json: vi.fn(), setHeader: vi.fn() };
}
const request = { method: "GET", headers: { authorization: "Bearer test-cron-secret" } };

beforeEach(() => {
  vi.useFakeTimers();
  vi.resetAllMocks();
  vi.stubEnv("CRON_SECRET", "test-cron-secret");
  vi.stubEnv("SUPABASE_URL", "https://test-project.supabase.co");
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  createClient.mockReturnValue({ from });
  from.mockReturnValue({ select });
  select.mockReturnValue({ limit });
  limit.mockReturnValue({ abortSignal: query });
  query.mockResolvedValue({ error: null, status: 200 });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Supabase keepalive", () => {
  it("rejects non-GET requests without touching the database", async () => {
    const res = response();
    await handler({ ...request, method: "POST" }, res);
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.setHeader).toHaveBeenCalledWith("Allow", "GET");
    expect(createClient).not.toHaveBeenCalled();
  });
  it("rejects missing or incorrect credentials", async () => {
    for (const authorization of [
      undefined,
      "Bearer wrong",
      ["Bearer test-cron-secret"],
    ]) {
      const res = response();
      await handler({ method: "GET", headers: { authorization } }, res);
      expect(res.status).toHaveBeenCalledWith(401);
    }
    expect(createClient).not.toHaveBeenCalled();
  });
  it("reports a missing cron secret", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const res = response();
    await handler(request, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(console.error).toHaveBeenCalledWith("keepalive.config_error", {
      missing: ["CRON_SECRET"],
    });
  });
  it("identifies missing database credentials after authentication", async () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const res = response();
    await handler(request, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ missing: ["SUPABASE_SERVICE_ROLE_KEY"] }),
    );
    expect(createClient).not.toHaveBeenCalled();
  });
  it("performs a real read and records its time without returning habit data", async () => {
    query.mockResolvedValue({
      error: null,
      status: 200,
      data: [{ id: "private-habit" }],
    });
    const res = response();
    await handler(request, res);
    expect(from).toHaveBeenCalledWith("habits");
    expect(select).toHaveBeenCalledWith("id");
    expect(limit).toHaveBeenCalledWith(1);
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      checkedAt: expect.any(String),
      attempts: 1,
    });
  });
  it("uses the existing Vite URL when a server URL is not set", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("VITE_SUPABASE_URL", "https://frontend-project.supabase.co");
    await handler(request, response());
    expect(createClient).toHaveBeenCalledWith(
      "https://frontend-project.supabase.co",
      "test-service-key",
      expect.any(Object),
    );
  });
  it("handles invalid configuration without leaking the value", async () => {
    vi.stubEnv("SUPABASE_URL", "invalid-private-url");
    const res = response();
    await handler(request, res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: "Invalid Supabase configuration.",
    });
  });
  it("retries a transient failure and confirms the successful attempt", async () => {
    query.mockResolvedValueOnce({ error: { code: "UNAVAILABLE" }, status: 503 });
    const res = response();
    const run = handler(request, res);
    await vi.runAllTimersAsync();
    await run;
    expect(query).toHaveBeenCalledTimes(2);
    expect(res.json).toHaveBeenCalledWith({
      ok: true,
      checkedAt: expect.any(String),
      attempts: 2,
    });
  });
  it("does not retry permission failures or expose raw database errors", async () => {
    query.mockResolvedValue({
      error: { code: "42501", message: "private details" },
      status: 403,
    });
    const res = response();
    await handler(request, res);
    expect(query).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(502);
    expect(JSON.stringify(res.json.mock.calls)).not.toContain("private details");
  });
  it("bounds retries for thrown transport failures", async () => {
    query.mockRejectedValue(new Error("private network details"));
    const res = response();
    const run = handler(request, res);
    await vi.runAllTimersAsync();
    await run;
    expect(query).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(502);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("aborts slow database requests and fails after the retry budget", async () => {
    query.mockImplementation(
      (signal: AbortSignal) =>
        new Promise((_, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted")), {
            once: true,
          });
        }),
    );
    const res = response();
    const run = handler(request, res);
    await vi.runAllTimersAsync();
    await run;
    expect(query).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(502);
    expect(vi.getTimerCount()).toBe(0);
  });
});
