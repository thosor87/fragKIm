import { describe, it, expect, vi } from "vitest";

describe("mistralCall", () => {
  it("wiederholt bei 429 und liefert dann das Ergebnis", async () => {
    vi.stubEnv("MISTRAL_MIN_INTERVAL_MS", "1");
    vi.resetModules();
    const { mistralCall } = await import("../src/rag/mistral-throttle.js");
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let n = 0;
    const out = await mistralCall(async () => {
      if (++n < 2) throw Object.assign(new Error("rate"), { statusCode: 429 });
      return "ok";
    });
    expect(out).toBe("ok");
    expect(n).toBe(2);
  });

  it("wiederholt 4xx (außer 429) nicht", async () => {
    vi.stubEnv("MISTRAL_MIN_INTERVAL_MS", "1");
    vi.resetModules();
    const { mistralCall } = await import("../src/rag/mistral-throttle.js");
    let n = 0;
    await expect(
      mistralCall(async () => {
        n++;
        throw Object.assign(new Error("auth"), { statusCode: 401 });
      }),
    ).rejects.toThrow("auth");
    expect(n).toBe(1);
  });

  it("hält Mindestabstand zwischen Aufrufen", async () => {
    vi.stubEnv("MISTRAL_MIN_INTERVAL_MS", "60");
    vi.resetModules();
    const { mistralCall } = await import("../src/rag/mistral-throttle.js");
    const t: number[] = [];
    await Promise.all([1, 2, 3].map(() => mistralCall(async () => void t.push(Date.now()))));
    expect(t[1] - t[0]).toBeGreaterThanOrEqual(50);
    expect(t[2] - t[1]).toBeGreaterThanOrEqual(50);
  });
});
