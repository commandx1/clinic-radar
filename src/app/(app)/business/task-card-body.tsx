import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";

import { TaskEvidenceLine } from "./task-evidence-line";

export interface TaskEvidence {
  ownPositive: number;
  ownNegative: number;
  competitorPositive: number;
  competitorNegative: number;
}

export interface TaskCardData {
  title: string;
  description: string | null;
  theme: string | null;
  priority: string | null;
  impact_score: number | null;
  effort_score: number | null;
  competitorName: string | null;
  source_type?: "competitive_gap" | "absolute_quality" | null;
  evidence?: TaskEvidence;
}

const PRIORITY_BADGE_VARIANT: Record<string, "destructive" | "default" | "secondary"> = {
  high: "destructive",
  medium: "default",
  low: "secondary",
};

export function TaskCardBody({ task, leadingBadge }: { task: TaskCardData; leadingBadge?: ReactNode }) {
  const t = useTranslations("business.tasks");

  return (
    <>
      <div className="flex items-center gap-2">
        {leadingBadge}
        {task.priority && (
          <Badge variant={PRIORITY_BADGE_VARIANT[task.priority] ?? "secondary"}>
            {t(`priority.${task.priority}`)}
          </Badge>
        )}
        {task.theme && <span className="text-xs text-muted-foreground">{task.theme}</span>}
      </div>

      <p className="font-medium">{task.title}</p>
      {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}

      <p className="text-xs text-muted-foreground">
        {t("impactEffort", { impact: task.impact_score ?? 0, effort: task.effort_score ?? 0 })}
      </p>
      {task.competitorName && (
        <p className="text-xs text-muted-foreground">
          {t("basedOnCompetitor", { name: task.competitorName })}
        </p>
      )}
      <TaskEvidenceLine sourceType={task.source_type} evidence={task.evidence} />
    </>
  );
}
