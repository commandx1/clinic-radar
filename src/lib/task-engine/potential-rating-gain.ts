// bkz. docs/09-task-engine.md — potential_rating_gain = sum(impact_score of open, high-priority tasks) / 1000.

export function calculatePotentialRatingGain(highPriorityOpenTaskImpactScores: (number | null)[]): number {
  const sum = highPriorityOpenTaskImpactScores.reduce((acc: number, v) => acc + (v ?? 0), 0);
  return sum / 1000;
}
