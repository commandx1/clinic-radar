import { useTranslations } from "next-intl";

import { AI_ANALYSIS_WINDOW_DAYS } from "@/lib/constants";

import type { TaskEvidence } from "./task-card-body";

// Görev kartındaki tek satırlık kanıt metni — own vs rakip mention kıyası,
// `theme_summary`'den kod tarafında hesaplanır (resolve-tasks-shared.ts).
// Tema eşleşmezse (isim drift'i) `evidence` undefined gelir, satır gizlenir —
// uydurma sayı göstermek yerine gizlemeyi tercih ediyoruz.
export function TaskEvidenceLine({
  sourceType,
  evidence,
}: {
  sourceType?: "competitive_gap" | "absolute_quality" | null;
  evidence?: TaskEvidence;
}) {
  const t = useTranslations("business.tasks.evidence");

  if (!evidence) {
    return null;
  }

  if (sourceType === "competitive_gap") {
    const strongCount = evidence.competitorStrongCount;
    const totalCount = evidence.competitorTotalCount;
    const hasBreakdown = typeof strongCount === "number" && typeof totalCount === "number";
    return (
      <p className="text-xs text-muted-foreground">
        {t("competitiveGap", {
          competitorPositive: evidence.competitorPositive,
          ownPositive: evidence.ownPositive,
        })}
        {hasBreakdown ? ` ${t("competitorBreakdown", { strongCount, totalCount })}` : null}
      </p>
    );
  }

  if (sourceType === "absolute_quality") {
    return (
      <p className="text-xs text-muted-foreground">
        {t("absoluteQuality", {
          days: AI_ANALYSIS_WINDOW_DAYS,
          ownNegative: evidence.ownNegative,
        })}
      </p>
    );
  }

  return null;
}
