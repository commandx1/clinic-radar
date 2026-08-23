import { describe, expect, it } from "vitest";

import { isRetryAllowedAfterFailure } from "@/lib/task-engine/analysis-cooldown";

// bkz. src/lib/constants.ts ANALYSIS_RUN_STALE_MS (15 dk) — bir 'running'
// koşusu bu eşikten eskiyse, onu başlatan serverless invocation'ın zaman
// aşımına uğradığı (Vercel maxDuration=300s) kabul edilir.
describe("isRetryAllowedAfterFailure", () => {
  const now = new Date("2026-08-23T12:00:00.000Z");

  it("son koşu null ise (hiç analiz yapılmamış) false döner — cooldown mantığı değişmez", () => {
    expect(isRetryAllowedAfterFailure(null, now)).toBe(false);
  });

  it("son koşu failed ise true döner — hemen tekrar denenebilir", () => {
    expect(
      isRetryAllowedAfterFailure({ status: "failed", started_at: "2026-08-23T11:00:00.000Z" }, now),
    ).toBe(true);
  });

  it("son koşu 'running' ve stale eşiğinden (15 dk) daha eski ise true döner — terk edilmiş koşu", () => {
    const staleStartedAt = new Date(now.getTime() - 16 * 60 * 1000).toISOString();
    expect(isRetryAllowedAfterFailure({ status: "running", started_at: staleStartedAt }, now)).toBe(true);
  });

  it("son koşu 'running' ve stale eşiğinden yeni (az önce başlamış) ise false döner — gerçekten devam ediyor", () => {
    const freshStartedAt = new Date(now.getTime() - 60 * 1000).toISOString();
    expect(isRetryAllowedAfterFailure({ status: "running", started_at: freshStartedAt }, now)).toBe(false);
  });

  it("son koşu 'running' ve tam olarak stale eşiğinde ise false döner (sınır dahil değil)", () => {
    const exactStartedAt = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
    expect(isRetryAllowedAfterFailure({ status: "running", started_at: exactStartedAt }, now)).toBe(false);
  });

  it("son koşu succeeded ise false döner — normal cooldown geçerli", () => {
    expect(
      isRetryAllowedAfterFailure({ status: "succeeded", started_at: "2026-08-23T11:00:00.000Z" }, now),
    ).toBe(false);
  });

  it("son koşu partial ise false döner — normal cooldown geçerli", () => {
    expect(
      isRetryAllowedAfterFailure({ status: "partial", started_at: "2026-08-23T11:00:00.000Z" }, now),
    ).toBe(false);
  });
});
