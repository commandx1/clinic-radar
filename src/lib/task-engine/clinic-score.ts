// bkz. docs/09-task-engine.md — Clinic Score formülü (v1 tahmini, kalibre edilecek).

export function calculateReviewGrowthNormalized(ownReviewGrowth: number, competitorAvgReviewGrowth: number): number {
  if (ownReviewGrowth === 0 && competitorAvgReviewGrowth === 0) {
    return 50;
  }
  const normalized = (ownReviewGrowth / (ownReviewGrowth + competitorAvgReviewGrowth)) * 100;
  return Math.min(100, Math.max(0, normalized));
}

export interface ClinicScoreInput {
  ownRating: number | null;
  taskDoneCount: number;
  taskTotalCount: number;
  ownReviewGrowth: number;
  competitorAvgReviewGrowth: number;
}

export function calculateClinicScore(input: ClinicScoreInput): number {
  const ratingComponent = ((input.ownRating ?? 0) / 5) * 100;
  const taskCompletionRate = input.taskTotalCount > 0 ? input.taskDoneCount / input.taskTotalCount : 0;
  const growthNormalized = calculateReviewGrowthNormalized(input.ownReviewGrowth, input.competitorAvgReviewGrowth);

  const score = 0.4 * ratingComponent + 0.3 * taskCompletionRate * 100 + 0.3 * growthNormalized;
  return Math.round(Math.min(100, Math.max(0, score)));
}

export function calculateCompetitorRank(
  ownRating: number | null,
  competitorRatings: (number | null)[],
): { rank: number; total: number } {
  const own = ownRating ?? 0;
  const rank = 1 + competitorRatings.filter((r) => (r ?? 0) > own).length;
  return { rank, total: competitorRatings.length + 1 };
}
