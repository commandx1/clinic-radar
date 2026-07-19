import { describe, expect, it } from "vitest";

import {
  computeAbsoluteQualityImpactScore,
  computeCompetitiveGapImpactScore,
} from "@/lib/task-engine/impact-score";

// Sabitler (bkz. src/lib/constants.ts): prevalence 0.5, own_deficiency 0.4,
// abs deficiency 0.7, abs volume 0.3, worsening +15, improving -10,
// mention volume scale = TASK_MENTION_THRESHOLD * 4 = 12.

describe("computeCompetitiveGapImpactScore", () => {
  it("rakip güçlü + own zayıf: bileşenler ağırlıklarla toplanır", () => {
    const result = computeCompetitiveGapImpactScore(
      { positive_mentions: 8, negative_mentions: 2 },
      { positive_mentions: 1, negative_mentions: 3 },
      null,
    );

    // prevalence = 8/10*100 = 80; deficiency = (1 - 1/4)*100 = 75
    // score = 80*0.5 + 75*0.4 = 70
    expect(result.breakdown.competitor_prevalence).toBe(80);
    expect(result.breakdown.own_deficiency).toBe(75);
    expect(result.breakdown.trend_adjustment).toBe(0);
    expect(result.score).toBe(70);
  });

  it("own teması hiç yoksa tam eksiklik (100) kabul edilir", () => {
    const result = computeCompetitiveGapImpactScore(
      { positive_mentions: 10, negative_mentions: 0 },
      undefined,
      null,
    );

    // prevalence = 100; deficiency = 100 → 100*0.5 + 100*0.4 = 90
    expect(result.breakdown.own_deficiency).toBe(100);
    expect(result.score).toBe(90);
  });

  it("worsening trend bonusu skoru 100'de clamp'ler", () => {
    const result = computeCompetitiveGapImpactScore(
      { positive_mentions: 10, negative_mentions: 0 },
      undefined,
      "worsening",
    );

    // 90 + 15 = 105 → clamp 100
    expect(result.breakdown.trend_adjustment).toBe(15);
    expect(result.score).toBe(100);
  });

  it("improving trend skoru düşürür", () => {
    const result = computeCompetitiveGapImpactScore(
      { positive_mentions: 10, negative_mentions: 0 },
      undefined,
      "improving",
    );

    expect(result.breakdown.trend_adjustment).toBe(-10);
    expect(result.score).toBe(80);
  });

  it("rakip mention toplamı sıfırsa prevalence 0 olur (bölme hatası yok)", () => {
    const result = computeCompetitiveGapImpactScore(
      { positive_mentions: 0, negative_mentions: 0 },
      undefined,
      null,
    );

    expect(result.breakdown.competitor_prevalence).toBe(0);
    expect(result.score).toBe(40);
  });
});

describe("computeAbsoluteQualityImpactScore", () => {
  it("tamamı negatif tema: deficiency 100 + hacim bileşeni", () => {
    const result = computeAbsoluteQualityImpactScore(
      { positive_mentions: 0, negative_mentions: 6 },
      null,
    );

    // deficiency = 100; volume = 6/12*100 = 50 → 100*0.7 + 50*0.3 = 85
    expect(result.breakdown.competitor_prevalence).toBeNull();
    expect(result.breakdown.own_deficiency).toBe(100);
    expect(result.score).toBe(85);
  });

  it("critical severity oranla sulandırılmaz — deficiency doğrudan 100", () => {
    const critical = computeAbsoluteQualityImpactScore(
      { positive_mentions: 20, negative_mentions: 1 },
      null,
      "critical",
    );
    const normal = computeAbsoluteQualityImpactScore(
      { positive_mentions: 20, negative_mentions: 1 },
      null,
      "normal",
    );

    // critical: 100*0.7 + 8*0.3 = 72.4 → 72; normal: 5*0.7 + 8*0.3 = 5.9 → 6
    expect(critical.breakdown.own_deficiency).toBe(100);
    expect(critical.score).toBe(72);
    expect(normal.score).toBe(6);
    expect(critical.score).toBeGreaterThan(normal.score);
  });

  it("hiç mention yoksa skor 0 (bölme hatası yok)", () => {
    const result = computeAbsoluteQualityImpactScore(
      { positive_mentions: 0, negative_mentions: 0 },
      null,
    );

    expect(result.score).toBe(0);
  });

  it("hacim bileşeni scale üstünde 100'de clamp'lenir", () => {
    const result = computeAbsoluteQualityImpactScore(
      { positive_mentions: 0, negative_mentions: 100 },
      null,
    );

    // deficiency 100, volume clamp 100 → 70 + 30 = 100
    expect(result.score).toBe(100);
  });
});
