import { NextResponse } from "next/server";
import { getLocale } from "next-intl/server";

import { aggregateCompetitorThemes, type AggregatedTheme } from "@/lib/ai-pipeline/aggregate-competitor-themes";
import {
  assertProviderConfigured,
  extractThemes,
  generateExecutiveSummary,
  generateGapAnalysis,
  type CompetitorThemeInput,
  type ReviewInput,
  type TaskCandidate,
  type ThemeExtractionOutput,
  type ThemeItem,
  type ThemeTrendInput,
} from "@/lib/ai-pipeline/provider";
import { fetchReviewsForPlaces, type ScrapedReview } from "@/lib/apify/google-reviews";
import {
  ABSOLUTE_QUALITY_NEGATIVE_RATIO_THRESHOLD,
  AI_ANALYSIS_WINDOW_DAYS,
  MAX_NEW_TASKS_PER_CYCLE,
  MIN_COMPETITORS,
  REVIEWS_FETCH_MAX_PER_PLACE,
  TASK_MENTION_THRESHOLD,
  THEME_TREND_DELTA_THRESHOLD,
  THEME_TREND_MIN_MENTIONS,
} from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { getNextAnalysisAvailableAt } from "@/lib/task-engine/analysis-cooldown";
import { calculateClinicScore, calculateCompetitorRank } from "@/lib/task-engine/clinic-score";
import { derivePriority } from "@/lib/task-engine/priority";
import { normalizeTheme, selectThemesToReopen } from "@/lib/task-engine/reopen";
import type { TablesInsert } from "@/types/database.types";

// Bkz. docs/04-api.md: Faz 1'de senkron çalışır (job/queue altyapısı yok,
// mevcut tüm Apify çağrılarıyla aynı desen). Own + rakipler tek batch Apify
// çağrısıyla çekilir, ardından Claude Aşama 1 (own + her rakip paralel),
// Aşama 2 ve Aşama 3 (executive summary, snapshot yazımından hemen önce) aynı
// istek içinde çalışır — bu yüzden maxDuration Apify + Claude fazlarının
// toplamını karşılayacak şekilde yükseltildi (deploy platformunun buna
// gerçekten izin verdiği doğrulanmalı).
export const maxDuration = 450;

const APIFY_TIMEOUT_MS = 280_000;

interface OwnerRef {
  owner_type: "own" | "competitor";
  business_id: string;
}

interface OwnerInfo {
  id: string;
  ownerType: "own" | "competitor";
  name: string;
  category: string | null;
}

interface Stage1Result {
  owner: OwnerInfo;
  result: ThemeExtractionOutput | null;
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function buildOwnerMap(
  business: { id: string; google_place_id: string },
  competitors: { id: string; google_place_id: string }[],
): Map<string, OwnerRef> {
  const ownerByPlaceId = new Map<string, OwnerRef>();
  ownerByPlaceId.set(business.google_place_id, { owner_type: "own", business_id: business.id });
  for (const competitor of competitors) {
    ownerByPlaceId.set(competitor.google_place_id, { owner_type: "competitor", business_id: competitor.id });
  }
  return ownerByPlaceId;
}

function mapToReviewRows(
  scraped: ScrapedReview[],
  ownerByPlaceId: Map<string, OwnerRef>,
): TablesInsert<"reviews">[] {
  const rows: TablesInsert<"reviews">[] = [];
  for (const review of scraped) {
    const owner = ownerByPlaceId.get(review.place_id);
    if (!owner) {
      continue;
    }
    rows.push({ ...review, ...owner });
  }
  return rows;
}

// Şema uyuşmazlığında (null) bir kez daha dener; SDK/ağ hatasında da aynı
// şekilde bir kez daha dener. İki deneme de başarısızsa null döner — çağıran
// taraf o owner'ı bu döngüde atlar (bkz. plan: retry-then-skip).
async function withRetryOnce<T>(fn: () => Promise<T | null>): Promise<T | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await fn();
      if (result) {
        return result;
      }
    } catch (err) {
      console.error("Claude stage attempt failed:", err);
    }
  }
  return null;
}

function hasResult(r: Stage1Result): r is Stage1Result & { result: ThemeExtractionOutput } {
  return r.result !== null;
}

async function fetchRecentReviews(
  supabase: SupabaseClient,
  ownerIds: string[],
  cutoffIso: string,
): Promise<Map<string, ReviewInput[]>> {
  const { data } = await supabase
    .from("reviews")
    .select("business_id, rating, text, original_language, published_at")
    .in("business_id", ownerIds)
    .or(`published_at.gte.${cutoffIso},published_at.is.null`);

  const byOwner = new Map<string, ReviewInput[]>();
  for (const row of data ?? []) {
    if (!row.text || row.text.trim() === "") {
      continue;
    }
    const list = byOwner.get(row.business_id) ?? [];
    list.push({
      rating: row.rating,
      text: row.text,
      language: row.original_language,
      published_at: row.published_at,
    });
    byOwner.set(row.business_id, list);
  }
  return byOwner;
}

async function runStage1ForOwners(
  owners: OwnerInfo[],
  reviewsByOwnerId: Map<string, ReviewInput[]>,
  outputLanguage: string,
): Promise<Stage1Result[]> {
  return Promise.all(
    owners.map(async (owner): Promise<Stage1Result> => {
      const reviews = reviewsByOwnerId.get(owner.id) ?? [];
      const result = await withRetryOnce(() =>
        extractThemes({ businessName: owner.name, category: owner.category, reviews, outputLanguage }),
      );
      return { owner, result };
    }),
  );
}

interface ThemeSummaryPersistResult {
  ownAggregated: AggregatedTheme[];
  competitorAggregated: AggregatedTheme[];
  hasCompetitorData: boolean;
  ownThemeTrends: ThemeTrendInput[];
  previousCounts: Map<string, MentionCounts>;
}

interface MentionCounts {
  positive_mentions: number;
  negative_mentions: number;
}

// bkz. docs/02-business-rules.md Bölüm C — trend AI değil kod tarafında,
// döngüler arası negatif oran deltasından hesaplanır. Önceki döngüde tema yoksa
// (model temayı farklı adlandırmışsa da eşleşme kaçar — fuzzy eşleştirme yok,
// bilinçli sınırlama) trend null kalır.
function computeTrend(prev: MentionCounts | undefined, next: MentionCounts): ThemeTrendInput["trend"] {
  const nextTotal = next.positive_mentions + next.negative_mentions;
  if (!prev || nextTotal < THEME_TREND_MIN_MENTIONS) {
    return null;
  }
  const prevTotal = prev.positive_mentions + prev.negative_mentions;
  if (prevTotal === 0) {
    return null;
  }
  const delta = next.negative_mentions / nextTotal - prev.negative_mentions / prevTotal;
  if (delta <= -THEME_TREND_DELTA_THRESHOLD) {
    return "improving";
  }
  if (delta >= THEME_TREND_DELTA_THRESHOLD) {
    return "worsening";
  }
  return "stable";
}

// Önceki döngünün satırları delete-then-reinsert ile silineceği için trend
// karşılaştırma verisi delete'lerden ÖNCE okunur.
async function fetchPreviousThemeCounts(
  supabase: SupabaseClient,
  businessId: string,
): Promise<Map<string, MentionCounts>> {
  const { data } = await supabase
    .from("theme_summary")
    .select("owner_type, theme, positive_mentions, negative_mentions")
    .eq("business_id", businessId);

  const byKey = new Map<string, MentionCounts>();
  for (const row of data ?? []) {
    byKey.set(`${row.owner_type}|${normalizeTheme(row.theme)}`, row);
  }
  return byKey;
}

function toThemeTrendRows(aggregated: AggregatedTheme[], ownerType: "own" | "competitor", previousCounts: Map<string, MentionCounts>): ThemeTrendInput[] {
  return aggregated.map((t) => ({
    theme: t.theme,
    trend: computeTrend(previousCounts.get(`${ownerType}|${normalizeTheme(t.theme)}`), t),
    positive_mentions: t.positive_mentions,
    negative_mentions: t.negative_mentions,
  }));
}

async function replaceThemeSummaryRows(
  supabase: SupabaseClient,
  businessId: string,
  ownerType: "own" | "competitor",
  rows: ThemeTrendInput[],
  periodStart: string,
  periodEnd: string,
): Promise<void> {
  await supabase.from("theme_summary").delete().eq("business_id", businessId).eq("owner_type", ownerType);
  if (rows.length > 0) {
    await supabase.from("theme_summary").insert(
      rows.map((t) => ({
        business_id: businessId,
        owner_type: ownerType,
        theme: t.theme,
        positive_mentions: t.positive_mentions,
        negative_mentions: t.negative_mentions,
        trend: t.trend,
        period_start: periodStart,
        period_end: periodEnd,
      })),
    );
  }
}

async function persistThemeSummary(
  supabase: SupabaseClient,
  businessId: string,
  ownResult: ThemeExtractionOutput | null,
  competitorStage1Results: Stage1Result[],
  periodStart: string,
  periodEnd: string,
): Promise<ThemeSummaryPersistResult> {
  const previousCounts = await fetchPreviousThemeCounts(supabase, businessId);

  const ownAggregated = ownResult
    ? aggregateCompetitorThemes([{ competitorId: "own", themes: ownResult.themes }])
    : [];
  const ownThemeTrends = toThemeTrendRows(ownAggregated, "own", previousCounts);

  if (ownResult) {
    await replaceThemeSummaryRows(supabase, businessId, "own", ownThemeTrends, periodStart, periodEnd);
  }

  const succeededCompetitors = competitorStage1Results.filter(hasResult);
  const hasCompetitorData = succeededCompetitors.length > 0;
  const competitorAggregated = hasCompetitorData
    ? aggregateCompetitorThemes(succeededCompetitors.map((r) => ({ competitorId: r.owner.id, themes: r.result.themes })))
    : [];

  if (hasCompetitorData) {
    const competitorRows = toThemeTrendRows(competitorAggregated, "competitor", previousCounts);
    await replaceThemeSummaryRows(supabase, businessId, "competitor", competitorRows, periodStart, periodEnd);
  }

  return { ownAggregated, competitorAggregated, hasCompetitorData, ownThemeTrends, previousCounts };
}

// bkz. docs/02-business-rules.md Bölüm E — `dismissed` bir görev, aynı temada
// negatif mention sayısı bir önceki döngüye göre 2x artarsa yeniden `open`
// olur. Bu adım upsertTasks'tan ÖNCE çalışmalı ki reopen edilen görevler
// upsertTasks tarafından mevcut "open" görev olarak eşleşip güncellensin,
// tekrar yeni satır olarak eklenmesin.
async function reopenBurstingDismissedTasks(
  supabase: SupabaseClient,
  businessId: string,
  previousCounts: Map<string, MentionCounts>,
  ownAggregated: AggregatedTheme[],
): Promise<void> {
  const themesToReopen = selectThemesToReopen(previousCounts, ownAggregated);
  if (themesToReopen.length === 0) {
    return;
  }

  const { data: dismissedTasks, error: selectError } = await supabase
    .from("tasks")
    .select("id, theme")
    .eq("business_id", businessId)
    .eq("status", "dismissed");

  if (selectError) {
    console.error("Failed to reopen dismissed tasks on negative mention burst:", selectError);
    return;
  }

  const normalizedThemesToReopen = new Set(themesToReopen.map(normalizeTheme));
  const matchedIds = dismissedTasks
    .filter((task) => task.theme !== null && normalizedThemesToReopen.has(normalizeTheme(task.theme)))
    .map((task) => task.id);

  if (matchedIds.length === 0) {
    return;
  }

  const { error } = await supabase
    .from("tasks")
    .update({ status: "open", last_priority_recalc_at: new Date().toISOString() })
    .in("id", matchedIds);

  if (error) {
    console.error("Failed to reopen dismissed tasks on negative mention burst:", error);
  }
}

// bkz. docs/02-business-rules.md Bölüm D — eşik/filtreleme mantığı promptta
// değil burada uygulanıyor.
function filterCandidates(
  candidates: TaskCandidate[],
  ownAggregated: AggregatedTheme[],
  competitorAggregated: AggregatedTheme[],
  hasCompetitorData: boolean,
): TaskCandidate[] {
  const ownByTheme = new Map(ownAggregated.map((t) => [normalizeTheme(t.theme), t]));
  const competitorByTheme = new Map(competitorAggregated.map((t) => [normalizeTheme(t.theme), t]));

  return candidates.filter((candidate) => {
    const key = normalizeTheme(candidate.theme);

    if (candidate.source_type === "absolute_quality") {
      const own = ownByTheme.get(key);
      if (!own) {
        return false;
      }
      const total = own.positive_mentions + own.negative_mentions;
      if (own.negative_mentions < TASK_MENTION_THRESHOLD || total === 0) {
        return false;
      }
      return own.negative_mentions / total > ABSOLUTE_QUALITY_NEGATIVE_RATIO_THRESHOLD;
    }

    if (!hasCompetitorData) {
      return false;
    }
    const competitor = competitorByTheme.get(key);
    return (competitor?.positive_mentions ?? 0) >= TASK_MENTION_THRESHOLD;
  });
}

function rankAndCapCandidates(candidates: TaskCandidate[]): TaskCandidate[] {
  return candidates
    .slice()
    .sort((a, b) => b.impact_score / b.effort_score - a.impact_score / a.effort_score)
    .slice(0, MAX_NEW_TASKS_PER_CYCLE);
}

async function upsertTasks(
  supabase: SupabaseClient,
  businessId: string,
  candidates: TaskCandidate[],
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const candidate of candidates) {
    const priority = derivePriority(candidate.impact_score, candidate.effort_score);

    const { data: existing } = await supabase
      .from("tasks")
      .select("id")
      .eq("business_id", businessId)
      .eq("theme", candidate.theme)
      .eq("source_type", candidate.source_type)
      .eq("status", "open")
      .maybeSingle();

    if (existing) {
      await supabase
        .from("tasks")
        .update({
          title_i18n: candidate.title,
          description_i18n: candidate.description,
          impact_score: candidate.impact_score,
          effort_score: candidate.effort_score,
          priority,
          based_on_competitor_id: candidate.based_on_competitor_id,
          last_priority_recalc_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      updated += 1;
    } else {
      await supabase.from("tasks").insert({
        business_id: businessId,
        title_i18n: candidate.title,
        description_i18n: candidate.description,
        source_type: candidate.source_type,
        based_on_competitor_id: candidate.based_on_competitor_id,
        theme: candidate.theme,
        impact_score: candidate.impact_score,
        effort_score: candidate.effort_score,
        priority,
      });
      created += 1;
    }
  }

  return { created, updated };
}

interface TaskGenerationSummary {
  status: "ok" | "skipped_own_failed" | "skipped_stage2_failed";
  created: number;
  updated: number;
}

async function runStage2AndUpsertTasks(
  supabase: SupabaseClient,
  businessId: string,
  ownThemes: ThemeItem[] | null,
  competitorStage1Results: Stage1Result[],
  aggregates: Omit<ThemeSummaryPersistResult, "hasCompetitorData"> & { hasCompetitorData: boolean },
): Promise<TaskGenerationSummary> {
  if (!ownThemes) {
    return { status: "skipped_own_failed", created: 0, updated: 0 };
  }

  const competitorsForStage2: CompetitorThemeInput[] = competitorStage1Results
    .filter(hasResult)
    .map((r) => ({ id: r.owner.id, name: r.owner.name, themes: r.result.themes }));

  const stage2Result = await withRetryOnce(() =>
    generateGapAnalysis({ ownThemes, competitors: competitorsForStage2 }),
  );

  if (!stage2Result) {
    return { status: "skipped_stage2_failed", created: 0, updated: 0 };
  }

  const filtered = filterCandidates(
    stage2Result.tasks,
    aggregates.ownAggregated,
    aggregates.competitorAggregated,
    aggregates.hasCompetitorData,
  );
  const ranked = rankAndCapCandidates(filtered);
  const { created, updated } = await upsertTasks(supabase, businessId, ranked);

  return { status: "ok", created, updated };
}

// Aşama 3 girdisi için bir önceki döngünün skoru — snapshot insert'inden önce
// çağrıldığı için gerçekten önceki döngüyü döner; ilk analizde null.
async function fetchPreviousScore(supabase: SupabaseClient, businessId: string): Promise<number | null> {
  const { data } = await supabase
    .from("clinic_score_history")
    .select("score")
    .eq("business_id", businessId)
    .order("snapshot_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.score ?? null;
}

// bkz. docs/09-task-engine.md Clinic Score formülü + docs/08-dashboard.md Trend
// sekmesi — her analiz döngüsü sonunda tek bir clinic_score_history satırı
// yazılır, Trend grafiği zamanla bu snapshot'ları biriktirir. Aşama 3 çıktısı
// (executive_summary) aynı satıra yazılır; üretilemezse null kalır ve run
// başarısız SAYILMAZ (bkz. docs/05-ai-pipeline.md Aşama 3 hata toleransı).
async function computeAndStoreClinicScoreSnapshot(
  supabase: SupabaseClient,
  business: { id: string; rating: number | null },
  competitors: { id: string; rating: number | null }[],
  cutoffIso: string,
  ownThemeTrends: ThemeTrendInput[],
): Promise<void> {
  const { count: taskTotalCount } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id)
    .gte("created_at", cutoffIso);

  const { count: taskDoneCount } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id)
    .eq("status", "done")
    .gte("created_at", cutoffIso);

  const { count: ownReviewGrowth } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id)
    .eq("owner_type", "own")
    .gte("published_at", cutoffIso);

  let competitorAvgReviewGrowth = 0;
  if (competitors.length > 0) {
    const { count: competitorReviewGrowthTotal } = await supabase
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .in(
        "business_id",
        competitors.map((c) => c.id),
      )
      .eq("owner_type", "competitor")
      .gte("published_at", cutoffIso);
    competitorAvgReviewGrowth = (competitorReviewGrowthTotal ?? 0) / competitors.length;
  }

  const score = calculateClinicScore({
    ownRating: business.rating,
    taskDoneCount: taskDoneCount ?? 0,
    taskTotalCount: taskTotalCount ?? 0,
    ownReviewGrowth: ownReviewGrowth ?? 0,
    competitorAvgReviewGrowth,
  });
  const { rank } = calculateCompetitorRank(
    business.rating,
    competitors.map((c) => c.rating),
  );

  const prevScore = await fetchPreviousScore(supabase, business.id);
  const summary = await withRetryOnce(() =>
    generateExecutiveSummary({
      score,
      prevScore,
      doneCount: taskDoneCount ?? 0,
      totalCount: taskTotalCount ?? 0,
      themeTrends: ownThemeTrends,
    }),
  );

  const { error } = await supabase.from("clinic_score_history").insert({
    business_id: business.id,
    score,
    competitor_rank: rank,
    executive_summary: summary?.summary ?? null,
  });

  if (error) {
    console.error("Failed to store clinic_score_history snapshot:", error);
  }
}

async function runAnalysisPipeline(
  supabase: SupabaseClient,
  business: { id: string; name: string; category: string | null },
  competitors: { id: string; name: string }[],
  outputLanguage: string,
) {
  const now = new Date();
  const periodStartDate = new Date(now.getTime() - AI_ANALYSIS_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const cutoffIso = periodStartDate.toISOString();
  const periodStart = cutoffIso.slice(0, 10);
  const periodEnd = now.toISOString().slice(0, 10);

  const owners: OwnerInfo[] = [
    { id: business.id, ownerType: "own", name: business.name, category: business.category },
    ...competitors.map((c) => ({
      id: c.id,
      ownerType: "competitor" as const,
      name: c.name,
      category: business.category,
    })),
  ];

  const reviewsByOwnerId = await fetchRecentReviews(
    supabase,
    owners.map((o) => o.id),
    cutoffIso,
  );

  const stage1Results = await runStage1ForOwners(owners, reviewsByOwnerId, outputLanguage);
  const ownStage1 = stage1Results.find((r) => r.owner.ownerType === "own") ?? null;
  const competitorStage1Results = stage1Results.filter((r) => r.owner.ownerType === "competitor");

  const aggregates = await persistThemeSummary(
    supabase,
    business.id,
    ownStage1?.result ?? null,
    competitorStage1Results,
    periodStart,
    periodEnd,
  );

  await reopenBurstingDismissedTasks(supabase, business.id, aggregates.previousCounts, aggregates.ownAggregated);

  const taskGeneration = await runStage2AndUpsertTasks(
    supabase,
    business.id,
    ownStage1?.result?.themes ?? null,
    competitorStage1Results,
    aggregates,
  );

  return {
    themeAnalysis: {
      ownersSucceeded: stage1Results
        .filter((r) => r.result)
        .map((r) => ({ id: r.owner.id, ownerType: r.owner.ownerType })),
      ownersFailed: stage1Results
        .filter((r) => !r.result)
        .map((r) => ({ id: r.owner.id, ownerType: r.owner.ownerType })),
    },
    taskGeneration,
    ownThemeTrends: aggregates.ownThemeTrends,
  };
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    assertProviderConfigured();
  } catch {
    return NextResponse.json({ error: "ai_provider_not_configured" }, { status: 502 });
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id, google_place_id, lat, name, category, rating, last_scraped_at")
    .eq("id", id)
    .maybeSingle();

  if (!business) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (business.lat === null || business.google_place_id === null) {
    return NextResponse.json({ error: "business_not_enriched" }, { status: 422 });
  }

  if (business.last_scraped_at) {
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("plan")
      .eq("user_id", user.id)
      .maybeSingle();
    const nextAvailableAt = getNextAnalysisAvailableAt(business.last_scraped_at, subscription?.plan);

    if (nextAvailableAt && nextAvailableAt.getTime() > Date.now()) {
      return NextResponse.json(
        { error: "analysis_cooldown_active", nextAvailableAt: nextAvailableAt.toISOString() },
        { status: 422 },
      );
    }
  }

  const { data: competitors } = await supabase
    .from("competitors")
    .select("id, google_place_id, name, rating")
    .eq("business_id", business.id);

  if (!competitors || competitors.length < MIN_COMPETITORS) {
    return NextResponse.json({ error: "insufficient_competitors" }, { status: 422 });
  }

  const ownerByPlaceId = buildOwnerMap(
    { id: business.id, google_place_id: business.google_place_id },
    competitors,
  );
  const placeIds = Array.from(ownerByPlaceId.keys());

  let scraped: ScrapedReview[];
  try {
    scraped = await fetchReviewsForPlaces(placeIds, REVIEWS_FETCH_MAX_PER_PLACE, {
      timeoutMs: APIFY_TIMEOUT_MS,
    });
  } catch (apifyError) {
    console.error("Review fetch failed:", apifyError);
    return NextResponse.json({ error: "apify_call_failed" }, { status: 502 });
  }

  const rows = mapToReviewRows(scraped, ownerByPlaceId);

  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from("reviews")
      .upsert(rows, { onConflict: "place_id,review_id" });

    if (upsertError) {
      console.error("Failed to store reviews:", upsertError);
      return NextResponse.json({ error: "review_save_failed" }, { status: 500 });
    }
  }

  const { error: touchError } = await supabase
    .from("businesses")
    .update({ last_scraped_at: new Date().toISOString() })
    .eq("id", business.id);

  if (touchError) {
    console.error("Failed to update last_scraped_at:", touchError);
  }

  const outputLanguage = await getLocale();
  const { themeAnalysis, taskGeneration, ownThemeTrends } = await runAnalysisPipeline(
    supabase,
    { id: business.id, name: business.name, category: business.category },
    competitors,
    outputLanguage,
  );

  const clinicScoreCutoffIso = new Date(
    Date.now() - AI_ANALYSIS_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  await computeAndStoreClinicScoreSnapshot(supabase, business, competitors, clinicScoreCutoffIso, ownThemeTrends);

  return NextResponse.json({
    fetched: scraped.length,
    stored: rows.length,
    ownReviews: rows.filter((r) => r.owner_type === "own").length,
    competitorReviews: rows.filter((r) => r.owner_type === "competitor").length,
    themeAnalysis,
    taskGeneration,
  });
}
