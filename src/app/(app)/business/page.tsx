import { getLocale, getTranslations } from "next-intl/server";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { extractRecentRatingTrendPoint, type RecentRatingsSnapshot } from "@/lib/analysis/recent-ratings";
import { hasProAccess, resolvePlanAccess } from "@/lib/billing/plan-access";
import { createClient } from "@/lib/supabase/server";
import {
  getNextAnalysisAvailableAt,
  isAnalysisCooldownActive,
  isRetryAllowedAfterFailure,
} from "@/lib/task-engine/analysis-cooldown";
import { calculatePotentialRatingGain } from "@/lib/task-engine/potential-rating-gain";
import type { Json } from "@/types/database.types";

import { AnalysisDeltaCard } from "./analysis-delta-card";
import { AnalysisRunTrigger } from "./analysis-run-trigger";
import { OpportunityEstimateCard } from "./opportunity-estimate-card";
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
  // Altı sorgu birbirinden bağımsız — seri await yerine paralel çalıştır
  // (sayfa açılış latency'sini tek round-trip'e indirir).
  const [
    { data: snapshots },
    { count: competitorCount },
    { count: criticalIssuesCount },
    { count: doneCount },
    { count: totalTasksCount },
    { data: highPriorityOpenTasks },
  ] = await Promise.all([
    supabase
      .from("clinic_score_history")
      .select("score, competitor_rank, snapshot_at, executive_summary, recent_ratings")
      .eq("business_id", businessId)
      .order("snapshot_at", { ascending: true }),
    supabase
      .from("competitors")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("priority", "high")
      .eq("status", "open"),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .eq("status", "done"),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId),
    supabase
      .from("tasks")
      .select("impact_score")
      .eq("business_id", businessId)
      .eq("priority", "high")
      .eq("status", "open"),
  ]);

  const latest = snapshots && snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;

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
      ...extractRecentRatingTrendPoint(s.recent_ratings as unknown as RecentRatingsSnapshot | null),
    })),
  };
}

// bkz. src/lib/task-engine/analysis-cooldown.ts — "Analizi çalıştır" butonunun
// açık mı kilitli mi olacağını tek yerde çözer. Cooldown YALNIZCA gerçekten
// tamamlanmış (succeeded/partial) bir analizden sonra uygulanır; 300 sn Vercel
// tavanında timeout olup 'running' kalan ya da 'failed' biten bir koşudan sonra
// kullanıcı hemen tekrar deneyebilmeli (POST /analysis/run zaten izin veriyor,
// bu olmadan UI onu kilitli gösteriyordu).
async function resolveAnalysisAvailability(
  supabase: SupabaseClient,
  businessId: string,
  lastScrapedAt: string | null,
  plan: "free" | "pro",
): Promise<{ nextAnalysisAvailableAt: string | null; cooldownActive: boolean }> {
  const nextAvailableAt = getNextAnalysisAvailableAt(lastScrapedAt, plan);
  const { data: latestRun } = await supabase
    .from("analysis_runs")
    .select("status, started_at")
    .eq("business_id", businessId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    nextAnalysisAvailableAt: nextAvailableAt ? nextAvailableAt.toISOString() : null,
    cooldownActive: isAnalysisCooldownActive(nextAvailableAt) && !isRetryAllowedAfterFailure(latestRun),
  };
}

export default async function OverviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // user hazır olduktan sonra bu altı iş birbirinden bağımsız — paralel çalıştır.
  const [{ data: business }, { data: subscription }, t, tReport, tSatisfaction, locale] =
    await Promise.all([
      supabase
        .from("businesses")
        .select(
          "id, name, category, google_place_id, last_scraped_at, trustpilot_domain, avg_patient_value_usd, monthly_new_patients",
        )
        .eq("user_id", user!.id)
        .maybeSingle(),
      supabase
        .from("subscriptions")
        .select("plan, status, current_period_end")
        .eq("user_id", user!.id)
        .maybeSingle(),
      getTranslations("business.overview"),
      getTranslations("business.monthlyReport"),
      getTranslations("business.satisfaction"),
      getLocale(),
    ]);

  // business.id'ye bağlı üç yükleme de birbirinden bağımsız — paralel çalıştır.
  const [metrics, satisfaction, openTasks, analysisAvailability] = await Promise.all([
    loadExecutiveMetrics(supabase, business!.id),
    loadSatisfactionOverview(supabase, business!.id),
    resolveOpenTasks(supabase, business!.id, locale),
    resolveAnalysisAvailability(
      supabase,
      business!.id,
      business!.last_scraped_at,
      resolvePlanAccess(subscription),
    ),
  ]);
  const summaryJson = metrics.latestSnapshot?.executive_summary;
  const executiveSummary = summaryJson ? pickLocale(summaryJson, locale) : null;
  const isPro = hasProAccess(subscription);

  return (
    <div className="flex flex-col gap-6">
      <AnalysisRunTrigger
        business={business!}
        isPro={isPro}
        nextAnalysisAvailableAt={analysisAvailability.nextAnalysisAvailableAt}
        cooldownActive={analysisAvailability.cooldownActive}
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

      <AnalysisDeltaCard businessId={business!.id} />

      <OpportunityEstimateCard businessId={business!.id} />

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
        {openTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("topTasksEmpty")}</p>
        ) : (
          <TaskList tasks={openTasks.slice(0, 3)} showTitle={false} />
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
