import { describe, expect, it } from "vitest";

import { estimateOpportunity, type OpportunityInput } from "@/lib/task-engine/opportunity-estimate";

function baseInput(overrides: Partial<OpportunityInput> = {}): OpportunityInput {
  return {
    ownRating: 4.2,
    competitorRatings: [4.5, 4.6, 4.4],
    ownReviewsInWindow: 9,
    competitorReviewsInWindow: [18, 18, 18],
    windowDays: 90,
    avgPatientValueUsd: null,
    monthlyNewPatients: null,
    ...overrides,
  };
}

describe("estimateOpportunity", () => {
  it("own puan yoksa ratingGap ve türevleri null döner", () => {
    const result = estimateOpportunity(baseInput({ ownRating: null }));
    expect(result.ratingGap).toBeNull();
    expect(result.revenueUpliftPctRange).toBeNull();
    expect(result.annualRevenueUsdRange).toBeNull();
    expect(result.belowFilterThreshold).toBe(false);
  });

  it("hiç rakip puanı yoksa ratingGap null döner", () => {
    const result = estimateOpportunity(baseInput({ competitorRatings: [null, null] }));
    expect(result.ratingGap).toBeNull();
    expect(result.competitorMedianRating).toBeNull();
  });

  it("rakip medyanını (tek sayı) doğru hesaplar ve gap'i 1dp yuvarlar", () => {
    const result = estimateOpportunity(baseInput({ ownRating: 4.2, competitorRatings: [4.5, 4.6, 4.4] }));
    expect(result.competitorMedianRating).toBe(4.5);
    expect(result.ratingGap).toBe(0.3);
  });

  it("rakip medyanını (çift sayı) ortalayarak hesaplar", () => {
    const result = estimateOpportunity(baseInput({ ownRating: 4.0, competitorRatings: [4.0, 5.0] }));
    expect(result.competitorMedianRating).toBe(4.5);
  });

  it("kullanıcı önde olduğunda negatif gap döner ve revenue range null olur", () => {
    const result = estimateOpportunity(baseInput({ ownRating: 4.8, competitorRatings: [4.5, 4.6] }));
    expect(result.ratingGap).toBeLessThan(0);
    expect(result.revenueUpliftPctRange).toBeNull();
    expect(result.annualRevenueUsdRange).toBeNull();
  });

  it("gap tam 0 olduğunda revenue range null olur", () => {
    const result = estimateOpportunity(baseInput({ ownRating: 4.5, competitorRatings: [4.5, 4.5] }));
    expect(result.ratingGap).toBe(0);
    expect(result.revenueUpliftPctRange).toBeNull();
  });

  it("gap pozitifse revenueUpliftPctRange = [gap*MIN, gap*MAX]", () => {
    const result = estimateOpportunity(baseInput({ ownRating: 4.2, competitorRatings: [4.5] }));
    expect(result.ratingGap).toBe(0.3);
    expect(result.revenueUpliftPctRange).toEqual([1.5, 2.7]);
  });

  it("iş girdileri eksikse annualRevenueUsdRange null olur (gap pozitif olsa bile)", () => {
    const result = estimateOpportunity(
      baseInput({ ownRating: 4.2, competitorRatings: [4.5], avgPatientValueUsd: 2000, monthlyNewPatients: null }),
    );
    expect(result.revenueUpliftPctRange).not.toBeNull();
    expect(result.annualRevenueUsdRange).toBeNull();
  });

  it("iş girdileri doluysa annualRevenueUsdRange hesaplanır ve 2 anlamlı basamağa yuvarlanır", () => {
    const result = estimateOpportunity(
      baseInput({ ownRating: 4.2, competitorRatings: [4.5], avgPatientValueUsd: 2000, monthlyNewPatients: 15 }),
    );
    // gap=0.3 -> pct=[1.5, 2.7] -> yıllık taban: 15*12*2000 = 360000
    // min: 360000 * 0.015 = 5400 -> 2 sig fig -> 5400
    // max: 360000 * 0.027 = 9720 -> 2 sig fig -> 9700
    expect(result.annualRevenueUsdRange).toEqual([5400, 9700]);
  });

  it("2 anlamlı basamağa yuvarlama büyük sayılarda kesinlik hissi vermez", () => {
    const result = estimateOpportunity(
      baseInput({ ownRating: 4.0, competitorRatings: [4.9], avgPatientValueUsd: 3000, monthlyNewPatients: 20 }),
    );
    const [min, max] = result.annualRevenueUsdRange!;
    expect(min % 100).toBe(0);
    expect(max % 100).toBe(0);
  });

  it("own < 4.0 ve rakip medyanı >= 4.0 ise belowFilterThreshold true", () => {
    const result = estimateOpportunity(baseInput({ ownRating: 3.8, competitorRatings: [4.0, 4.2] }));
    expect(result.belowFilterThreshold).toBe(true);
  });

  it("own >= 4.0 ise belowFilterThreshold false", () => {
    const result = estimateOpportunity(baseInput({ ownRating: 4.0, competitorRatings: [4.0, 4.2] }));
    expect(result.belowFilterThreshold).toBe(false);
  });

  it("rakip medyanı da 4.0 altındaysa belowFilterThreshold false (rekabet fırsatı değil)", () => {
    const result = estimateOpportunity(baseInput({ ownRating: 3.5, competitorRatings: [3.6, 3.7] }));
    expect(result.belowFilterThreshold).toBe(false);
  });

  it("yorum hızını aylığa çevirir (90 günlük pencere / 30 = 3 ay)", () => {
    const result = estimateOpportunity(baseInput({ ownReviewsInWindow: 9, competitorReviewsInWindow: [18, 18, 18] }));
    expect(result.ownReviewsPerMonth).toBe(3);
    expect(result.competitorAvgReviewsPerMonth).toBe(6);
    expect(result.reviewVelocityRatio).toBe(0.5);
  });

  it("rakip ortalaması 0 ise reviewVelocityRatio null olur", () => {
    const result = estimateOpportunity(baseInput({ competitorReviewsInWindow: [0, 0] }));
    expect(result.reviewVelocityRatio).toBeNull();
    expect(result.velocityGap).toBe(false);
  });

  it("velocityGap, ratio eşiğin altında olduğunda true olur", () => {
    const result = estimateOpportunity(baseInput({ ownReviewsInWindow: 5, competitorReviewsInWindow: [20, 20] }));
    expect(result.reviewVelocityRatio).toBeLessThan(0.7);
    expect(result.velocityGap).toBe(true);
  });

  it("velocityGap, ratio eşiğin üstünde/eşit olduğunda false olur", () => {
    const result = estimateOpportunity(baseInput({ ownReviewsInWindow: 15, competitorReviewsInWindow: [20, 20] }));
    expect(result.reviewVelocityRatio).toBeGreaterThanOrEqual(0.7);
    expect(result.velocityGap).toBe(false);
  });
});
