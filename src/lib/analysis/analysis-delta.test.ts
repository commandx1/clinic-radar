import { describe, expect, it } from "vitest";

import { buildAnalysisDelta, type BuildAnalysisDeltaInput } from "@/lib/analysis/analysis-delta";

// Sabitler (bkz. analysis-delta.ts): en fazla 3 rakip / 5 tema gösterilir.

function makeInput(overrides: Partial<BuildAnalysisDeltaInput> = {}): BuildAnalysisDeltaInput {
  return {
    windowDays: 90,
    previousRunAt: "2026-08-01T00:00:00.000Z",
    ownNewReviews: 2,
    competitorNewReviewsByCompetitor: [],
    ownUnrepliedReviews: 1,
    tasksCreated: 1,
    tasksUpdated: 0,
    tasksReopened: 0,
    ownThemeTrends: [],
    taskGenerationStatus: "ok",
    filteredCandidateCount: 1,
    ...overrides,
  };
}

describe("buildAnalysisDelta", () => {
  it("tasks_created > 0 iken zero_new_tasks_reason null olur", () => {
    const delta = buildAnalysisDelta(makeInput({ tasksCreated: 2 }));
    expect(delta.zero_new_tasks_reason).toBeNull();
  });

  it("own Aşama 1 başarısızsa own_analysis_failed döner", () => {
    const delta = buildAnalysisDelta(
      makeInput({ tasksCreated: 0, taskGenerationStatus: "skipped_own_failed", filteredCandidateCount: 0 }),
    );
    expect(delta.zero_new_tasks_reason).toBe("own_analysis_failed");
  });

  it("Aşama 2 (gap analysis) başarısızsa stage2_failed döner", () => {
    const delta = buildAnalysisDelta(
      makeInput({ tasksCreated: 0, taskGenerationStatus: "skipped_stage2_failed", filteredCandidateCount: 0 }),
    );
    expect(delta.zero_new_tasks_reason).toBe("stage2_failed");
  });

  it("own temalar vardı ama hiçbiri filtreyi geçemediyse all_themes_below_threshold döner", () => {
    const delta = buildAnalysisDelta(
      makeInput({
        tasksCreated: 0,
        taskGenerationStatus: "ok",
        filteredCandidateCount: 0,
        ownThemeTrends: [{ theme: "bekleme süresi", trend: "stable", severity: "normal" }],
      }),
    );
    expect(delta.zero_new_tasks_reason).toBe("all_themes_below_threshold");
  });

  it("own tema hiç yoksa no_new_signal döner", () => {
    const delta = buildAnalysisDelta(
      makeInput({ tasksCreated: 0, taskGenerationStatus: "ok", filteredCandidateCount: 0, ownThemeTrends: [] }),
    );
    expect(delta.zero_new_tasks_reason).toBe("no_new_signal");
  });

  it("filtrelenen aday mevcut açık görevi güncellediyse (created=0, filtered>0) no_new_signal döner", () => {
    const delta = buildAnalysisDelta(
      makeInput({
        tasksCreated: 0,
        tasksUpdated: 1,
        taskGenerationStatus: "ok",
        filteredCandidateCount: 1,
        ownThemeTrends: [{ theme: "temizlik", trend: "stable", severity: "normal" }],
      }),
    );
    expect(delta.zero_new_tasks_reason).toBe("no_new_signal");
  });

  it("rakip yeni yorumlarını sayıya göre azalan sıralar ve en çok 3 tanesini döner", () => {
    const delta = buildAnalysisDelta(
      makeInput({
        competitorNewReviewsByCompetitor: [
          { competitor_id: "a", name: "A Kliniği", count: 2 },
          { competitor_id: "b", name: "B Kliniği", count: 9 },
          { competitor_id: "c", name: "C Kliniği", count: 0 },
          { competitor_id: "d", name: "D Kliniği", count: 5 },
          { competitor_id: "e", name: "E Kliniği", count: 3 },
        ],
      }),
    );
    expect(delta.competitor_new_reviews).toBe(19);
    expect(delta.competitor_new_reviews_top).toEqual([
      { competitor_id: "b", name: "B Kliniği", count: 9 },
      { competitor_id: "d", name: "D Kliniği", count: 5 },
      { competitor_id: "e", name: "E Kliniği", count: 3 },
    ]);
  });

  it("0 sayılı rakipleri top listeye almaz", () => {
    const delta = buildAnalysisDelta(
      makeInput({
        competitorNewReviewsByCompetitor: [
          { competitor_id: "a", name: "A Kliniği", count: 0 },
          { competitor_id: "b", name: "B Kliniği", count: 0 },
        ],
      }),
    );
    expect(delta.competitor_new_reviews).toBe(0);
    expect(delta.competitor_new_reviews_top).toEqual([]);
  });

  it("tema listelerini trend/severity'ye göre ayırır ve en çok 5'e sınırlar", () => {
    const manyWorsening = Array.from({ length: 7 }, (_, i) => ({
      theme: `tema-${String(i)}`,
      trend: "worsening" as const,
      severity: "normal" as const,
    }));
    const delta = buildAnalysisDelta(
      makeInput({
        ownThemeTrends: [
          ...manyWorsening,
          { theme: "iyileşen tema", trend: "improving", severity: "normal" },
          { theme: "kritik tema", trend: "stable", severity: "critical" },
        ],
      }),
    );
    expect(delta.themes_worsening).toHaveLength(5);
    expect(delta.themes_worsening).toEqual(manyWorsening.slice(0, 5).map((t) => t.theme));
    expect(delta.themes_improving).toEqual(["iyileşen tema"]);
    expect(delta.themes_critical).toEqual(["kritik tema"]);
  });

  it("diğer alanları girdiden birebir taşır", () => {
    const delta = buildAnalysisDelta(
      makeInput({
        windowDays: 180,
        previousRunAt: null,
        ownNewReviews: 4,
        ownUnrepliedReviews: 6,
        tasksCreated: 3,
        tasksUpdated: 2,
        tasksReopened: 1,
      }),
    );
    expect(delta).toMatchObject({
      version: 1,
      window_days: 180,
      previous_run_at: null,
      own_new_reviews: 4,
      own_unreplied_reviews: 6,
      tasks_created: 3,
      tasks_updated: 2,
      tasks_reopened: 1,
    });
  });
});
