import { AlertTriangle, CheckCircle2, Gauge, TrendingUp, Trophy } from "lucide-react";
import type { getTranslations } from "next-intl/server";

import { StatCard } from "./stat-card";

type OverviewTranslator = Awaited<ReturnType<typeof getTranslations<"business.overview">>>;

export function OverviewStatsGrid({
  t,
  score,
  competitorRank,
  competitorTotal,
  criticalIssuesCount,
  doneCount,
  totalTasksCount,
  potentialRatingGain,
}: {
  t: OverviewTranslator;
  score: number;
  competitorRank: number | null;
  competitorTotal: number;
  criticalIssuesCount: number;
  doneCount: number;
  totalTasksCount: number;
  potentialRatingGain: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      <StatCard label={t("clinicScore")} value={String(score)} icon={Gauge} tone="primary" />
      <StatCard
        label={t("competitorRank")}
        value={
          competitorRank !== null
            ? t("competitorRankValue", { rank: competitorRank, total: competitorTotal })
            : "-"
        }
        icon={Trophy}
        tone="gold"
      />
      <StatCard
        label={t("criticalIssues")}
        value={t("criticalIssuesValue", { count: criticalIssuesCount })}
        icon={AlertTriangle}
        tone={criticalIssuesCount > 0 ? "destructive" : "muted"}
      />
      <StatCard
        label={t("completedTasks")}
        value={t("completedTasksValue", { done: doneCount, total: totalTasksCount })}
        icon={CheckCircle2}
        tone="primary"
      />
      <StatCard
        label={t("potentialRatingGain")}
        value={t("potentialRatingGainValue", { value: potentialRatingGain.toFixed(1) })}
        icon={TrendingUp}
        tone="cta"
      />
    </div>
  );
}
