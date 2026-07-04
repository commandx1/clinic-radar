import { TASK_PRIORITY_HIGH_THRESHOLD, TASK_PRIORITY_MEDIUM_THRESHOLD } from "@/lib/constants";

export type TaskPriority = "high" | "medium" | "low";

// bkz. docs/09-task-engine.md — priority_raw = impact_score / effort_score
export function derivePriority(impactScore: number, effortScore: number): TaskPriority {
  const priorityRaw = impactScore / effortScore;

  if (priorityRaw >= TASK_PRIORITY_HIGH_THRESHOLD) {
    return "high";
  }
  if (priorityRaw >= TASK_PRIORITY_MEDIUM_THRESHOLD) {
    return "medium";
  }
  return "low";
}
