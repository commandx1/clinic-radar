import { describe, expect, it } from "vitest";

import type { AggregatedTheme } from "@/lib/ai-pipeline/aggregate-competitor-themes";
import type { TaskCandidate, ThemeTrendInput } from "@/lib/ai-pipeline/provider";
import {
  attachImpactScores,
  filterCandidates,
  rankCandidates,
  type ScoredTaskCandidate,
} from "@/lib/analysis/task-candidates";
import {
  computeAbsoluteQualityImpactScore,
  computeCompetitiveGapImpactScore,
} from "@/lib/task-engine/impact-score";

// Sabitler (bkz. src/lib/constants.ts): TASK_MENTION_THRESHOLD = 3,
// ABSOLUTE_QUALITY_NEGATIVE_RATIO_THRESHOLD = 0.3.

function makeCandidate(overrides: Partial<TaskCandidate> = {}): TaskCandidate {
  return {
    title: { tr: "Başlık", en: "Title" },
    description: { tr: "Açıklama", en: "Description" },
    source_type: "absolute_quality",
    based_on_competitor_id: null,
    theme: "temizlik",
    effort_score: 2,
    checklist: [
      { tr: "Adım 1", en: "Step 1" },
      { tr: "Adım 2", en: "Step 2" },
      { tr: "Adım 3", en: "Step 3" },
    ],
    ...overrides,
  };
}

function makeTheme(overrides: Partial<AggregatedTheme> = {}): AggregatedTheme {
  return {
    theme: "temizlik",
    positive_mentions: 0,
    negative_mentions: 0,
    treatment: null,
    severity: "normal",
    ...overrides,
  };
}

function makeTrend(overrides: Partial<ThemeTrendInput> = {}): ThemeTrendInput {
  return {
    theme: "temizlik",
    trend: null,
    positive_mentions: 0,
    negative_mentions: 0,
    ...overrides,
  };
}

describe("filterCandidates — absolute_quality", () => {
  it("own tarafında tema yoksa aday elenir", () => {
    const result = filterCandidates([makeCandidate()], [], [], false);
    expect(result).toHaveLength(0);
  });

  it("hiç olumsuz mention yoksa elenir", () => {
    const result = filterCandidates(
      [makeCandidate()],
      [makeTheme({ positive_mentions: 10, negative_mentions: 0 })],
      [],
      false,
    );
    expect(result).toHaveLength(0);
  });

  it("critical tema tek bir olumsuz mention ile bile eşiği atlar", () => {
    const result = filterCandidates(
      [makeCandidate()],
      [makeTheme({ positive_mentions: 20, negative_mentions: 1, severity: "critical" })],
      [],
      false,
    );
    expect(result).toHaveLength(1);
  });

  it("olumsuz mention sayısı eşiğin (3) altındaysa elenir", () => {
    const result = filterCandidates(
      [makeCandidate()],
      [makeTheme({ positive_mentions: 1, negative_mentions: 2 })],
      [],
      false,
    );
    expect(result).toHaveLength(0);
  });

  it("olumsuz oran eşiğe (0.3) eşitse elenir — sınır dahil değil", () => {
    // 3 / 10 = 0.3, kesinlikle büyük olmalı
    const result = filterCandidates(
      [makeCandidate()],
      [makeTheme({ positive_mentions: 7, negative_mentions: 3 })],
      [],
      false,
    );
    expect(result).toHaveLength(0);
  });

  it("olumsuz oran eşiğin üstündeyse geçer", () => {
    // 3 / 9 ≈ 0.33 > 0.3
    const result = filterCandidates(
      [makeCandidate()],
      [makeTheme({ positive_mentions: 6, negative_mentions: 3 })],
      [],
      false,
    );
    expect(result).toHaveLength(1);
  });

  it("tema eşleşmesi normalize edilir (büyük/küçük harf + boşluk)", () => {
    const result = filterCandidates(
      [makeCandidate({ theme: "  Temizlik " })],
      [makeTheme({ theme: "temizlik", positive_mentions: 6, negative_mentions: 3 })],
      [],
      false,
    );
    expect(result).toHaveLength(1);
  });
});

describe("filterCandidates — competitive_gap", () => {
  const gapCandidate = makeCandidate({ source_type: "competitive_gap" });

  it("rakip verisi yoksa (hasCompetitorData=false) elenir", () => {
    const result = filterCandidates(
      [gapCandidate],
      [],
      [makeTheme({ positive_mentions: 10 })],
      false,
    );
    expect(result).toHaveLength(0);
  });

  it("rakip olumlu mention eşiğin altındaysa elenir", () => {
    const result = filterCandidates(
      [gapCandidate],
      [],
      [makeTheme({ positive_mentions: 2 })],
      true,
    );
    expect(result).toHaveLength(0);
  });

  it("rakip olumlu mention eşiğe eşit veya üstündeyse geçer", () => {
    const result = filterCandidates(
      [gapCandidate],
      [],
      [makeTheme({ positive_mentions: 3 })],
      true,
    );
    expect(result).toHaveLength(1);
  });

  it("rakip tarafında tema hiç yoksa elenir", () => {
    const result = filterCandidates([gapCandidate], [], [], true);
    expect(result).toHaveLength(0);
  });
});

describe("attachImpactScores", () => {
  it("absolute_quality adayı own kırılımı + trend + severity ile skorlanır", () => {
    const own = makeTheme({ positive_mentions: 2, negative_mentions: 6, severity: "critical" });
    const [scored] = attachImpactScores(
      [makeCandidate()],
      [own],
      [],
      [makeTrend({ trend: "worsening" })],
    );

    const expected = computeAbsoluteQualityImpactScore(own, "worsening", "critical");
    expect(scored.impact_score).toBe(expected.score);
    expect(scored.impact_score_breakdown).toEqual(expected.breakdown);
  });

  it("competitive_gap adayı rakip + own kırılımıyla skorlanır", () => {
    const competitor = makeTheme({ positive_mentions: 8, negative_mentions: 2 });
    const own = makeTheme({ positive_mentions: 1, negative_mentions: 3 });
    const [scored] = attachImpactScores(
      [makeCandidate({ source_type: "competitive_gap" })],
      [own],
      [competitor],
      [],
    );

    const expected = computeCompetitiveGapImpactScore(competitor, own, null);
    expect(scored.impact_score).toBe(expected.score);
    expect(scored.impact_score_breakdown).toEqual(expected.breakdown);
  });

  it("own tarafında tema yoksa sıfır mention + null trend varsayılır", () => {
    const [scored] = attachImpactScores([makeCandidate()], [], [], []);

    const expected = computeAbsoluteQualityImpactScore(
      { positive_mentions: 0, negative_mentions: 0 },
      null,
      "normal",
    );
    expect(scored.impact_score).toBe(expected.score);
    expect(scored.impact_score_breakdown).toEqual(expected.breakdown);
  });

  it("aday alanlarını korur (spread) ve skor alanlarını ekler", () => {
    const candidate = makeCandidate();
    const [scored] = attachImpactScores([candidate], [], [], []);

    expect(scored.theme).toBe(candidate.theme);
    expect(scored.checklist).toEqual(candidate.checklist);
    expect(typeof scored.impact_score).toBe("number");
  });
});

describe("rankCandidates", () => {
  function makeScored(impact: number, effort: number, theme: string): ScoredTaskCandidate {
    return {
      ...makeCandidate({ theme, effort_score: effort }),
      impact_score: impact,
      impact_score_breakdown: {
        competitor_prevalence: 0,
        own_deficiency: 0,
        trend: null,
        trend_adjustment: 0,
      },
    };
  }

  it("impact/effort oranına göre azalan sıralar", () => {
    // a: 80/4=20, b: 60/2=30, c: 50/1=50
    const ranked = rankCandidates([
      makeScored(80, 4, "a"),
      makeScored(60, 2, "b"),
      makeScored(50, 1, "c"),
    ]);
    expect(ranked.map((c) => c.theme)).toEqual(["c", "b", "a"]);
  });

  it("girdi dizisini mutasyona uğratmaz", () => {
    const input = [makeScored(10, 1, "a"), makeScored(90, 1, "b")];
    rankCandidates(input);
    expect(input.map((c) => c.theme)).toEqual(["a", "b"]);
  });
});
