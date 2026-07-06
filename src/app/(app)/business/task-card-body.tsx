import { Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

import { TaskEvidenceLine } from "./task-evidence-line";

export interface TaskEvidence {
  ownPositive: number;
  ownNegative: number;
  competitorPositive: number;
  competitorNegative: number;
  // bkz. docs/10-roadmap.md Faz 1.2 madde 3 — rakip bazlı tema kırılımı (N rakibinden M'i güçlü).
  // Kırılım verisi yoksa (competitor_id'li satır bulunamadıysa) undefined kalır.
  competitorStrongCount?: number;
  competitorTotalCount?: number;
  // Bu kanıtın kapsadığı gerçek gün sayısı (adaptif pencere — bkz. resolve-tasks-shared.ts).
  // Yoksa (eski satırlar) AI_ANALYSIS_WINDOW_DAYS'e düşülür.
  periodDays?: number;
  // bkz. docs/02-business-rules.md Bölüm D — own tarafında sağlık/güvenlik
  // zararı, ciddi etik/yasal risk ya da dolandırıcılık iddiası içeren tek bir
  // yorum bile bu temayı 'critical' yapabilir (mention sayısından bağımsız).
  isCritical?: boolean;
}

export interface TaskChecklistItem {
  text: string;
  done: boolean;
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
  checklist?: TaskChecklistItem[];
}

const PRIORITY_BADGE_VARIANT: Record<string, "destructive" | "default" | "secondary"> = {
  high: "destructive",
  medium: "default",
  low: "secondary",
};

export function TaskCardBody({
  task,
  leadingBadge,
  onToggleChecklistItem,
  checklistPendingIndex,
}: {
  task: TaskCardData;
  leadingBadge?: ReactNode;
  onToggleChecklistItem?: (index: number, done: boolean) => void;
  checklistPendingIndex?: number | null;
}) {
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

      {task.checklist && task.checklist.length > 0 && (
        <div className="flex flex-col gap-1.5 pt-1">
          <p className="text-xs font-medium text-muted-foreground">{t("checklist.title")}</p>
          <ul className="flex flex-col gap-1.5">
            {task.checklist.map((item, index) => (
              <li key={index} className="flex items-start gap-2">
                {checklistPendingIndex === index ? (
                  <Loader2Icon className="size-4 shrink-0 animate-spin text-muted-foreground" />
                ) : (
                  <Checkbox
                    checked={item.done}
                    disabled={!onToggleChecklistItem}
                    onCheckedChange={(checked) => {
                      onToggleChecklistItem?.(index, checked);
                    }}
                  />
                )}
                <span
                  className={
                    item.done ? "text-sm text-muted-foreground line-through" : "text-sm"
                  }
                >
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
