import { describe, expect, it } from "vitest";

import { calculatePotentialRatingGain } from "@/lib/task-engine/potential-rating-gain";

describe("calculatePotentialRatingGain", () => {
  it("boş listede 0 döner", () => {
    expect(calculatePotentialRatingGain([])).toBe(0);
  });

  it("null skorları 0 sayarak toplar ve 1000'e böler", () => {
    expect(calculatePotentialRatingGain([500, null, 250])).toBe(0.75);
  });

  it("tek görev: impact/1000", () => {
    expect(calculatePotentialRatingGain([80])).toBe(0.08);
  });

  it("mention payı arttıkça monoton artar", () => {
    expect(calculatePotentialRatingGain([100, 100])).toBeGreaterThan(calculatePotentialRatingGain([100]));
  });
});
