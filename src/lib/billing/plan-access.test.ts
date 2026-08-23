import { describe, expect, it } from "vitest";

import { hasProAccess, resolvePlanAccess } from "@/lib/billing/plan-access";

const NOW = new Date("2026-08-23T00:00:00.000Z");
const FUTURE = "2026-09-01T00:00:00.000Z";
const PAST = "2026-08-01T00:00:00.000Z";

describe("hasProAccess", () => {
  it("active + pro plan → true", () => {
    expect(
      hasProAccess({ plan: "pro", status: "active", current_period_end: FUTURE }, NOW),
    ).toBe(true);
  });

  it("active + agency plan → true", () => {
    expect(
      hasProAccess({ plan: "agency", status: "active", current_period_end: FUTURE }, NOW),
    ).toBe(true);
  });

  it("active + free plan → false", () => {
    expect(
      hasProAccess({ plan: "free", status: "active", current_period_end: null }, NOW),
    ).toBe(false);
  });

  it("past_due + pro plan → true (dunning grace)", () => {
    expect(
      hasProAccess({ plan: "pro", status: "past_due", current_period_end: PAST }, NOW),
    ).toBe(true);
  });

  it("canceled + current_period_end in the future → true (dönem sonuna kadar erişim)", () => {
    expect(
      hasProAccess({ plan: "pro", status: "canceled", current_period_end: FUTURE }, NOW),
    ).toBe(true);
  });

  it("canceled + current_period_end in the past → false", () => {
    expect(
      hasProAccess({ plan: "pro", status: "canceled", current_period_end: PAST }, NOW),
    ).toBe(false);
  });

  it("canceled + current_period_end null → false", () => {
    expect(
      hasProAccess({ plan: "pro", status: "canceled", current_period_end: null }, NOW),
    ).toBe(false);
  });

  it("free plan, herhangi bir status → false", () => {
    expect(
      hasProAccess({ plan: "free", status: "canceled", current_period_end: FUTURE }, NOW),
    ).toBe(false);
  });

  it("null satır → false", () => {
    expect(hasProAccess(null, NOW)).toBe(false);
  });

  it("undefined satır → false", () => {
    expect(hasProAccess(undefined, NOW)).toBe(false);
  });

  it("beklenmeyen status değeri → false (defensive default)", () => {
    expect(
      hasProAccess({ plan: "pro", status: "expired", current_period_end: FUTURE }, NOW),
    ).toBe(false);
  });
});

describe("resolvePlanAccess", () => {
  it("hasProAccess true iken 'pro' döner", () => {
    expect(resolvePlanAccess({ plan: "pro", status: "active", current_period_end: FUTURE }, NOW)).toBe(
      "pro",
    );
  });

  it("hasProAccess false iken 'free' döner", () => {
    expect(
      resolvePlanAccess({ plan: "pro", status: "canceled", current_period_end: PAST }, NOW),
    ).toBe("free");
  });

  it("satır yokken 'free' döner", () => {
    expect(resolvePlanAccess(null, NOW)).toBe("free");
  });
});
