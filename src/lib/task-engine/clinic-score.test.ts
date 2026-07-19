import { describe, expect, it } from "vitest";

import {
  calculateClinicScore,
  calculateCompetitorRank,
  calculateReviewGrowthNormalized,
} from "@/lib/task-engine/clinic-score";

describe("calculateReviewGrowthNormalized", () => {
  it("iki taraf da sıfır büyümede nötr 50 döner", () => {
    expect(calculateReviewGrowthNormalized(0, 0)).toBe(50);
  });

  it("yalnız own büyüyorsa 100, yalnız rakip büyüyorsa 0", () => {
    expect(calculateReviewGrowthNormalized(5, 0)).toBe(100);
    expect(calculateReviewGrowthNormalized(0, 5)).toBe(0);
  });

  it("eşit büyüme 50'ye normalize olur", () => {
    expect(calculateReviewGrowthNormalized(10, 10)).toBe(50);
  });
});

describe("calculateClinicScore", () => {
  it("v1 formülü: 0.4*rating + 0.3*taskCompletion + 0.3*growth", () => {
    const score = calculateClinicScore({
      ownRating: 4.0, // → 80
      taskDoneCount: 3,
      taskTotalCount: 4, // → 75
      ownReviewGrowth: 10,
      competitorAvgReviewGrowth: 10, // → 50
    });

    // 0.4*80 + 0.3*75 + 0.3*50 = 69.5 → round 70
    expect(score).toBe(70);
  });

  it("rating null ise rating bileşeni 0 sayılır", () => {
    const score = calculateClinicScore({
      ownRating: null,
      taskDoneCount: 0,
      taskTotalCount: 0, // bölme hatası yok → 0
      ownReviewGrowth: 0,
      competitorAvgReviewGrowth: 0, // → nötr 50
    });

    // 0 + 0 + 0.3*50 = 15
    expect(score).toBe(15);
  });

  it("tavan 100'de clamp'lenir", () => {
    const score = calculateClinicScore({
      ownRating: 5,
      taskDoneCount: 10,
      taskTotalCount: 10,
      ownReviewGrowth: 100,
      competitorAvgReviewGrowth: 0,
    });

    expect(score).toBe(100);
  });
});

describe("calculateCompetitorRank", () => {
  it("kendinden yüksek ratingli rakip sayısı + 1 = sıralama", () => {
    expect(calculateCompetitorRank(4.5, [4.8, 4.2, null])).toEqual({ rank: 2, total: 4 });
  });

  it("null rating 0 kabul edilir", () => {
    expect(calculateCompetitorRank(null, [null])).toEqual({ rank: 1, total: 2 });
    expect(calculateCompetitorRank(null, [3.1])).toEqual({ rank: 2, total: 2 });
  });
});
