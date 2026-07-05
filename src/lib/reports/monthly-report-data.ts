import { pickLocale } from "@/app/(app)/business/resolve-tasks-shared";
import type { createClient } from "@/lib/supabase/server";
import { calculatePotentialRatingGain } from "@/lib/task-engine/potential-rating-gain";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

const REPORT_PERIOD_DAYS = 30;

export interface MonthlyReportThemeRow {
  theme: string;
  positiveMentions: number;
  negativeMentions: number;
}

export interface MonthlyReportData {
  businessName: string;
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  score: number | null;
  scoreDeltaSincePeriodStart: number | null;
  competitorRank: number | null;
  competitorTotal: number;
  criticalIssuesCount: number;
  completedTasksInPeriod: number;
  potentialRatingGain: number;
  topPositiveThemes: MonthlyReportThemeRow[];
  topNegativeThemes: MonthlyReportThemeRow[];
  executiveSummary: string | null;
}

export async function loadMonthlyReportData(
  supabase: SupabaseClient,
  businessId: string,
  businessName: string,
  locale: string,
): Promise<MonthlyReportData> {
  const now = new Date();
  const periodStart = new Date(now.getTime() - REPORT_PERIOD_DAYS * 24 * 60 * 60 * 1000);

  const { data: snapshots } = await supabase
    .from("clinic_score_history")
    .select("score, competitor_rank, snapshot_at, executive_summary")
    .eq("business_id", businessId)
    .order("snapshot_at", { ascending: true });

  const latest = snapshots && snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  // Kadans adaptif/haftalık olduğu için tam 30 gün önceki snapshot nadiren var —
  // en yakın (o tarihten önceki en son) snapshot'a düşülür. Hiç yoksa delta gösterilmez.
  const periodStartSnapshot = (snapshots ?? [])
    .filter((s) => new Date(s.snapshot_at) <= periodStart)
    .at(-1);

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

  const { count: completedTasksInPeriod } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("status", "done")
    .gte("completed_at", periodStart.toISOString());

  const { data: highPriorityOpenTasks } = await supabase
    .from("tasks")
    .select("impact_score")
    .eq("business_id", businessId)
    .eq("priority", "high")
    .eq("status", "open");

  const { data: themeSummaries } = await supabase
    .from("theme_summary")
    .select("theme, positive_mentions, negative_mentions")
    .eq("business_id", businessId)
    .eq("owner_type", "own");

  const themeRows: MonthlyReportThemeRow[] = (themeSummaries ?? []).map((row) => ({
    theme: row.theme,
    positiveMentions: row.positive_mentions,
    negativeMentions: row.negative_mentions,
  }));

  return {
    businessName,
    generatedAt: now.toISOString(),
    periodStart: periodStart.toISOString(),
    periodEnd: now.toISOString(),
    score: latest?.score ?? null,
    scoreDeltaSincePeriodStart:
      typeof latest?.score === "number" && typeof periodStartSnapshot?.score === "number"
        ? latest.score - periodStartSnapshot.score
        : null,
    competitorRank: latest?.competitor_rank ?? null,
    competitorTotal: (competitorCount ?? 0) + 1,
    criticalIssuesCount: criticalIssuesCount ?? 0,
    completedTasksInPeriod: completedTasksInPeriod ?? 0,
    potentialRatingGain: calculatePotentialRatingGain((highPriorityOpenTasks ?? []).map((t) => t.impact_score)),
    topPositiveThemes: [...themeRows].sort((a, b) => b.positiveMentions - a.positiveMentions).slice(0, 3),
    topNegativeThemes: [...themeRows].sort((a, b) => b.negativeMentions - a.negativeMentions).slice(0, 3),
    executiveSummary: latest?.executive_summary ? pickLocale(latest.executive_summary, locale) : null,
  };
}
