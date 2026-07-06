import { getLocale, getTranslations } from "next-intl/server";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/server";
import { getNextAnalysisAvailableAt, isAnalysisCooldownActive } from "@/lib/task-engine/analysis-cooldown";
import { calculatePotentialRatingGain } from "@/lib/task-engine/potential-rating-gain";
import type { Json } from "@/types/database.types";

import { AnalysisRunTrigger } from "./analysis-run-trigger";
import { OverviewStatsGrid } from "./overview-stats-grid";
import { resolveOpenTasks } from "./resolve-open-tasks";
import { pickLocale } from "./resolve-tasks-shared";
import { SatisfactionCard } from "./satisfaction-card";
import { loadSatisfactionOverview } from "./satisfaction-overview";
import { TaskList } from "./task-list";
import { TrendChart, type TrendPoint } from "./trend-chart";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

interface ExecutiveMetrics {
  latestSnapshot: { score: number; competitor_rank: number | null; executive_summary: Json | null } | null;
  competitorTotal: number;
  criticalIssuesCount: number;
  doneCount: number;
  totalTasksCount: number;
  potentialRatingGain: number;
  trendPoints: TrendPoint[];
}

async function loadExecutiveMetrics(supabase: SupabaseClient, businessId: string): Promise<ExecutiveMetrics> {
  const { data: snapshots } = await supabase
    .from("clinic_score_history")
    .select("score, competitor_rank, snapshot_at, executive_summary")
    .eq("business_id", businessId)
    .order("snapshot_at", { ascending: true });

  const latest = snapshots && snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;

  const { count: competitorCount } = await supabase
    .from("competitors")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId);

  const { count: criticalIssuesCount } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("priority", "high")
    .eq("status", "open");

  const { count: doneCount } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("status", "done");

  const { count: totalTasksCount } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId);

  const { data: highPriorityOpenTasks } = await supabase
    .from("tasks")
    .select("impact_score")
    .eq("business_id", businessId)
    .eq("priority", "high")
    .eq("status", "open");

  return {
    latestSnapshot: latest
      ? { score: latest.score ?? 0, competitor_rank: latest.competitor_rank, executive_summary: latest.executive_summary }
      : null,
    competitorTotal: (competitorCount ?? 0) + 1,
    criticalIssuesCount: criticalIssuesCount ?? 0,
    doneCount: doneCount ?? 0,
    totalTasksCount: totalTasksCount ?? 0,
    potentialRatingGain: calculatePotentialRatingGain((highPriorityOpenTasks ?? []).map((t) => t.impact_score)),
    trendPoints: (snapshots ?? []).map((s) => ({
      snapshotAt: s.snapshot_at,
      score: s.score,
      competitorRank: s.competitor_rank,
    })),
  };
}

export default async function OverviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, category, google_place_id, last_scraped_at")
    .eq("user_id", user!.id)
    .maybeSingle();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan")
    .eq("user_id", user!.id)
    .maybeSingle();

  const t = await getTranslations("business.overview");
  const tReport = await getTranslations("business.monthlyReport");
  const tSatisfaction = await getTranslations("business.satisfaction");
  const locale = await getLocale();

  const metrics = await loadExecutiveMetrics(supabase, business!.id);
  const satisfaction = await loadSatisfactionOverview(supabase, business!.id);
  const topTasks = (await resolveOpenTasks(supabase, business!.id, locale)).slice(0, 3);
  const nextAnalysisAvailableAt = getNextAnalysisAvailableAt(business!.last_scraped_at, subscription?.plan);
  const executiveSummary = metrics.latestSnapshot?.executive_summary
    ? pickLocale(metrics.latestSnapshot.executive_summary, locale)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <AnalysisRunTrigger
        business={business!}
        nextAnalysisAvailableAt={nextAnalysisAvailableAt ? nextAnalysisAvailableAt.toISOString() : null}
        cooldownActive={isAnalysisCooldownActive(nextAnalysisAvailableAt)}
      />

      {executiveSummary && (
        <Card>
          <CardContent className="flex flex-col gap-1">
            <p className="text-xs text-muted-foreground">{t("executiveSummaryTitle")}</p>
            <p className="text-sm leading-relaxed">{executiveSummary}</p>
          </CardContent>
        </Card>
      )}

      {metrics.latestSnapshot ? (
        <OverviewStatsGrid
          t={t}
          score={metrics.latestSnapshot.score}
          competitorRank={metrics.latestSnapshot.competitor_rank}
          competitorTotal={metrics.competitorTotal}
          criticalIssuesCount={metrics.criticalIssuesCount}
          doneCount={metrics.doneCount}
          totalTasksCount={metrics.totalTasksCount}
          potentialRatingGain={metrics.potentialRatingGain}
        />
      ) : (
        <p className="text-sm text-muted-foreground">{t("notEnoughData")}</p>
      )}

      <SatisfactionCard t={tSatisfaction} overview={satisfaction} compact />

      {metrics.latestSnapshot && (
        <a
          href={`/api/business/${business!.id}/monthly-report`}
          className={buttonVariants({ variant: "outline", size: "sm", className: "self-start" })}
        >
          {tReport("downloadButton")}
        </a>
      )}

      <Separator />

      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("topTasksTitle")}</h2>
        {topTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("topTasksEmpty")}</p>
        ) : (
          <TaskList tasks={topTasks} showTitle={false} />
        )}
      </div>

      {metrics.trendPoints.length >= 2 && (
        <>
          <Separator />
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">{t("trendPreviewTitle")}</h2>
            <TrendChart points={metrics.trendPoints.slice(-8)} />
          </div>
        </>
      )}
    </div>
  );
}
