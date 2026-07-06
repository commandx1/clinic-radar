import { type SupabaseClient } from "@supabase/supabase-js";

import { aggregateCompetitorThemes, type AggregatedTheme } from "@/lib/ai-pipeline/aggregate-competitor-themes";
import {
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
import { estimateScrapeCostUsd, type ScrapeMetrics } from "@/lib/analysis/scrape-metrics";
import { fetchReviewsForPlaces, type ScrapedReview } from "@/lib/apify/google-reviews";
import {
  ABSOLUTE_QUALITY_NEGATIVE_RATIO_THRESHOLD,
  AI_ANALYSIS_MIN_OWN_REVIEWS_FOR_WINDOW,
  AI_ANALYSIS_WINDOW_DAYS,
  AI_ANALYSIS_WINDOW_DAYS_STEPS,
  MAX_NEW_TASKS_PER_CYCLE,
  REVIEWS_FETCH_MAX_PER_PLACE,
  TASK_MENTION_THRESHOLD,
  THEME_TREND_DELTA_THRESHOLD,
  THEME_TREND_MIN_MENTIONS,
} from "@/lib/constants";
import { recordNotification } from "@/lib/notifications/record-notification";
import { detectAndNotifyThemeSpikes } from "@/lib/notifications/theme-spike";
import { calculateClinicScore, calculateCompetitorRank } from "@/lib/task-engine/clinic-score";
import {
  computeAbsoluteQualityImpactScore,
  computeCompetitiveGapImpactScore,
  type ImpactScoreBreakdown,
  type ThemeTrend,
} from "@/lib/task-engine/impact-score";
import { derivePriority } from "@/lib/task-engine/priority";
import { normalizeTheme, selectThemesToReopen } from "@/lib/task-engine/reopen";
import type { Database, Json, TablesInsert } from "@/types/database.types";

// bkz. docs/04-api.md — Apify çağrısının varsayılan zaman aşımı; manuel
// route'ta ve cron route'unda ortak kullanılır, cron kendi timeout'unu
// options ile geçebilir.
const DEFAULT_APIFY_TIMEOUT_MS = 280_000;

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

type AnalysisSupabaseClient = SupabaseClient<Database>;

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

// bkz. docs/11-risks-assumptions.md Risk 1 — sabit 90 günlük pencere, düşük
// yorum hızlı işletmelerde DB'de zaten mevcut eski yorumları görmezden gelip
// her temayı TASK_MENTION_THRESHOLD'un altında bırakabilir. Own tarafında
// metinli yorum sayısı en dar adımda (90 gün) yetersizse, pencere own+rakip
// için AYNI ANDA (adil kıyas bozulmadan) bir sonraki adıma genişletilir.
async function determineAnalysisWindowDays(
  supabase: AnalysisSupabaseClient,
  ownBusinessId: string,
): Promise<number> {
  const maxDays = AI_ANALYSIS_WINDOW_DAYS_STEPS[AI_ANALYSIS_WINDOW_DAYS_STEPS.length - 1];
  const maxCutoffIso = new Date(Date.now() - maxDays * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from("reviews")
    .select("published_at")
    .eq("business_id", ownBusinessId)
    .eq("owner_type", "own")
    .not("text", "is", null)
    .gte("published_at", maxCutoffIso);

  const publishedAtMs = (data ?? [])
    .filter((row): row is { published_at: string } => row.published_at !== null)
    .map((row) => new Date(row.published_at).getTime());

  for (const days of AI_ANALYSIS_WINDOW_DAYS_STEPS) {
    const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
    const count = publishedAtMs.filter((ms) => ms >= cutoffMs).length;
    if (count >= AI_ANALYSIS_MIN_OWN_REVIEWS_FOR_WINDOW) {
      return days;
    }
  }
  return maxDays;
}

async function fetchRecentReviews(
  supabase: AnalysisSupabaseClient,
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
  windowDays: number,
): Promise<Stage1Result[]> {
  return Promise.all(
    owners.map(async (owner): Promise<Stage1Result> => {
      const reviews = reviewsByOwnerId.get(owner.id) ?? [];
      const result = await withRetryOnce(() =>
        extractThemes({ businessName: owner.name, category: owner.category, reviews, outputLanguage, windowDays }),
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
  supabase: AnalysisSupabaseClient,
  businessId: string,
): Promise<Map<string, MentionCounts>> {
  const { data } = await supabase
    .from("theme_summary")
    .select("owner_type, competitor_id, theme, positive_mentions, negative_mentions")
    .eq("business_id", businessId);

  const byKey = new Map<string, MentionCounts>();
  for (const row of data ?? []) {
    byKey.set(`${row.owner_type}|${row.competitor_id ?? "agg"}|${normalizeTheme(row.theme)}`, row);
  }
  return byKey;
}

// bkz. docs/10-roadmap.md Faz 1.2 madde 3 — `competitorId` verilirse (own hariç)
// trend karşılaştırması ve saklanan satır o rakibe özel olur; verilmezse
// (own ya da agregat rakip satırı) davranış eskisiyle birebir aynıdır.
function toThemeTrendRows(
  aggregated: AggregatedTheme[],
  ownerType: "own" | "competitor",
  previousCounts: Map<string, MentionCounts>,
  competitorId: string | null = null,
): ThemeTrendInput[] {
  return aggregated.map((t) => ({
    theme: t.theme,
    trend: computeTrend(previousCounts.get(`${ownerType}|${competitorId ?? "agg"}|${normalizeTheme(t.theme)}`), t),
    positive_mentions: t.positive_mentions,
    negative_mentions: t.negative_mentions,
    competitor_id: competitorId,
    treatment: t.treatment,
    severity: t.severity,
  }));
}

async function replaceThemeSummaryRows(
  supabase: AnalysisSupabaseClient,
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
        competitor_id: t.competitor_id ?? null,
        theme: t.theme,
        positive_mentions: t.positive_mentions,
        negative_mentions: t.negative_mentions,
        trend: t.trend,
        treatment: t.treatment ?? null,
        severity: t.severity ?? "normal",
        period_start: periodStart,
        period_end: periodEnd,
      })),
    );
  }
}

async function persistThemeSummary(
  supabase: AnalysisSupabaseClient,
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
    // Toplulaştırılmış satır (competitor_id = NULL) — skorlama/filtreleme/
    // bildirim/Themes-sayfası bunu okumaya devam eder, davranış DEĞİŞMEDİ.
    const aggregatedRows = toThemeTrendRows(competitorAggregated, "competitor", previousCounts);
    // Rakip bazlı satırlar (competitor_id dolu) — YENİ, sadece görev kartı
    // kanıt satırı ("N rakibinden M'i güçlü") için. `aggregateCompetitorThemes`
    // tek rakiplik girdiyle çağrılır — o rakibin kendi mention kırılımını verir.
    const perCompetitorRows = succeededCompetitors.flatMap((r) =>
      toThemeTrendRows(
        aggregateCompetitorThemes([{ competitorId: r.owner.id, themes: r.result.themes }]),
        "competitor",
        previousCounts,
        r.owner.id,
      ),
    );
    await replaceThemeSummaryRows(
      supabase,
      businessId,
      "competitor",
      [...aggregatedRows, ...perCompetitorRows],
      periodStart,
      periodEnd,
    );
  }

  return { ownAggregated, competitorAggregated, hasCompetitorData, ownThemeTrends, previousCounts };
}

// bkz. docs/02-business-rules.md Bölüm E — `dismissed` bir görev, aynı temada
// negatif mention sayısı bir önceki döngüye göre 2x artarsa yeniden `open`
// olur. Bu adım upsertTasks'tan ÖNCE çalışmalı ki reopen edilen görevler
// upsertTasks tarafından mevcut "open" görev olarak eşleşip güncellensin,
// tekrar yeni satır olarak eklenmesin.
async function reopenBurstingDismissedTasks(
  supabase: AnalysisSupabaseClient,
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
      if (total === 0 || own.negative_mentions === 0) {
        return false;
      }
      // bkz. docs/02-business-rules.md Bölüm D — sağlık/güvenlik zararı, ciddi
      // etik/yasal risk ya da dolandırıcılık iddiası içeren bir tema
      // 'critical' işaretlenmişse, tek bir olumsuz yorum bile mention-sayı
      // eşiğini atlayıp görev üretebilir (ciddiyet, sıklıktan bağımsızdır).
      if (own.severity === "critical") {
        return true;
      }
      if (own.negative_mentions < TASK_MENTION_THRESHOLD) {
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

export interface ScoredTaskCandidate extends TaskCandidate {
  impact_score: number;
  impact_score_breakdown: ImpactScoreBreakdown;
}

// bkz. docs/10-roadmap.md Faz 1.2 madde 2 — impact_score artık Aşama 2
// modelinden gelmiyor; her adayın teması için own/competitor mention
// kırılımı ve trend'i kullanılarak kod tarafında (@/lib/task-engine/impact-score)
// hesaplanır.
function attachImpactScores(
  candidates: TaskCandidate[],
  ownAggregated: AggregatedTheme[],
  competitorAggregated: AggregatedTheme[],
  ownThemeTrends: ThemeTrendInput[],
): ScoredTaskCandidate[] {
  const ownByTheme = new Map(ownAggregated.map((t) => [normalizeTheme(t.theme), t]));
  const competitorByTheme = new Map(competitorAggregated.map((t) => [normalizeTheme(t.theme), t]));
  const ownTrendByTheme = new Map<string, ThemeTrend>(
    ownThemeTrends.map((t) => [normalizeTheme(t.theme), t.trend]),
  );

  return candidates.map((candidate) => {
    const key = normalizeTheme(candidate.theme);
    const ownTheme = ownByTheme.get(key);
    const ownTrend = ownTrendByTheme.get(key) ?? null;

    const { score, breakdown } =
      candidate.source_type === "absolute_quality"
        ? computeAbsoluteQualityImpactScore(
            ownTheme ?? { positive_mentions: 0, negative_mentions: 0 },
            ownTrend,
            ownTheme?.severity ?? "normal",
          )
        : computeCompetitiveGapImpactScore(
            competitorByTheme.get(key) ?? { positive_mentions: 0, negative_mentions: 0 },
            ownTheme,
            ownTrend,
          );

    return { ...candidate, impact_score: score, impact_score_breakdown: breakdown };
  });
}

function rankAndCapCandidates(candidates: ScoredTaskCandidate[]): ScoredTaskCandidate[] {
  return candidates
    .slice()
    .sort((a, b) => b.impact_score / b.effort_score - a.impact_score / a.effort_score)
    .slice(0, MAX_NEW_TASKS_PER_CYCLE);
}

async function upsertTasks(
  supabase: AnalysisSupabaseClient,
  businessId: string,
  candidates: ScoredTaskCandidate[],
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
          impact_score_breakdown: candidate.impact_score_breakdown as unknown as Json,
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
        impact_score_breakdown: candidate.impact_score_breakdown as unknown as Json,
        effort_score: candidate.effort_score,
        priority,
        // bkz. supabase/migrations/20260708000000_tasks_checklist_i18n.sql —
        // sadece yeni görevde set edilir; mevcut açık görev güncellenirken
        // (yukarıdaki "existing" dalı) checklist_i18n bilinçli olarak
        // ÜZERİNE YAZILMIYOR ki kullanıcının işaretlediği ilerleme kaybolmasın.
        checklist_i18n: candidate.checklist.map((item) => ({ ...item, done: false })),
      });
      // bkz. docs/02-business-rules.md Bölüm G kural 1 — yeni görev
      // oluştuğunda anlık değil, haftalık özete dahil edilecek şekilde kaydedilir.
      await recordNotification(supabase, {
        businessId,
        type: "competitor_review_delta",
        payload: { theme: candidate.theme, title_i18n: candidate.title },
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
  supabase: AnalysisSupabaseClient,
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
  const scored = attachImpactScores(
    filtered,
    aggregates.ownAggregated,
    aggregates.competitorAggregated,
    aggregates.ownThemeTrends,
  );
  const ranked = rankAndCapCandidates(scored);
  const { created, updated } = await upsertTasks(supabase, businessId, ranked);

  return { status: "ok", created, updated };
}

// Aşama 3 girdisi için bir önceki döngünün skoru — snapshot insert'inden önce
// çağrıldığı için gerçekten önceki döngüyü döner; ilk analizde null.
async function fetchPreviousScore(supabase: AnalysisSupabaseClient, businessId: string): Promise<number | null> {
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
  supabase: AnalysisSupabaseClient,
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
  supabase: AnalysisSupabaseClient,
  business: { id: string; name: string; category: string | null },
  competitors: { id: string; name: string }[],
  outputLanguage: string,
  notifyContext: { isPro: boolean; ownerEmail: string | null },
) {
  const now = new Date();
  const windowDays = await determineAnalysisWindowDays(supabase, business.id);
  const periodStartDate = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
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

  const stage1Results = await runStage1ForOwners(owners, reviewsByOwnerId, outputLanguage, windowDays);
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

  // bkz. docs/02-business-rules.md Bölüm G kural 3 — yalnızca Pro plan
  // işletmeler için kritik sinyal kontrolü; free planlarda haftalık özete
  // sınırlı kalır.
  await detectAndNotifyThemeSpikes(supabase, {
    businessId: business.id,
    businessName: business.name,
    isPro: notifyContext.isPro,
    ownerEmail: notifyContext.ownerEmail,
    locale: outputLanguage === "en" ? "en" : "tr",
    ownAggregated: aggregates.ownAggregated,
    previousCounts: aggregates.previousCounts,
  });

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

type AnalysisPipelineResult = Awaited<ReturnType<typeof runAnalysisPipeline>>;

type ExecuteAnalysisResult =
  | {
      ok: true;
      status: "succeeded" | "partial";
      fetched: number;
      stored: number;
      ownReviews: number;
      competitorReviews: number;
      themeAnalysis: AnalysisPipelineResult["themeAnalysis"];
      taskGeneration: TaskGenerationSummary;
      scrape: ScrapeMetrics;
    }
  | {
      ok: false;
      error: "apify_call_failed" | "review_save_failed";
      scrape: ScrapeMetrics;
    };

// bkz. docs/04-api.md — hem manuel run route'u hem de haftalık cron aynı
// pipeline'ı çağırır; guard/cooldown/yetkilendirme kontrolleri çağıran
// tarafta kalır, burada sadece "review fetch → theme analiz → görev üretimi
// → clinic score snapshot" akışı yürütülür.
export async function executeAnalysis(
  supabase: AnalysisSupabaseClient,
  business: {
    id: string;
    google_place_id: string;
    lat: number | null;
    name: string;
    category: string | null;
    rating: number | null;
  },
  competitors: { id: string; google_place_id: string; name: string; rating: number | null }[],
  outputLanguage: string,
  notifyContext: { isPro: boolean; ownerEmail: string | null },
  options?: { apifyTimeoutMs?: number },
): Promise<ExecuteAnalysisResult> {
  const ownerByPlaceId = buildOwnerMap({ id: business.id, google_place_id: business.google_place_id }, competitors);
  const placeIds = Array.from(ownerByPlaceId.keys());

  // bkz. docs/11-risks-assumptions.md Risk 3 — scrape başarı/maliyet/latency
  // ölçümü; yalnızca gözlem, akış davranışını değiştirmez.
  const scrapeStartedAt = Date.now();
  let scraped: ScrapedReview[];
  try {
    scraped = await fetchReviewsForPlaces(placeIds, REVIEWS_FETCH_MAX_PER_PLACE, {
      timeoutMs: options?.apifyTimeoutMs ?? DEFAULT_APIFY_TIMEOUT_MS,
    });
  } catch (apifyError) {
    console.error("Yorum çekme başarısız:", apifyError);
    return {
      ok: false,
      error: "apify_call_failed",
      scrape: { success: false, fetchedReviews: null, latencyMs: Date.now() - scrapeStartedAt, costUsd: null },
    };
  }

  const scrape: ScrapeMetrics = {
    success: true,
    fetchedReviews: scraped.length,
    latencyMs: Date.now() - scrapeStartedAt,
    costUsd: estimateScrapeCostUsd(scraped.length),
  };

  const rows = mapToReviewRows(scraped, ownerByPlaceId);

  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from("reviews")
      .upsert(rows, { onConflict: "place_id,review_id" });

    if (upsertError) {
      console.error("Yorumlar kaydedilemedi:", upsertError);
      return { ok: false, error: "review_save_failed", scrape };
    }
  }

  const { error: touchError } = await supabase
    .from("businesses")
    .update({ last_scraped_at: new Date().toISOString() })
    .eq("id", business.id);

  if (touchError) {
    console.error("last_scraped_at güncellenemedi:", touchError);
  }

  const { themeAnalysis, taskGeneration, ownThemeTrends } = await runAnalysisPipeline(
    supabase,
    { id: business.id, name: business.name, category: business.category },
    competitors,
    outputLanguage,
    notifyContext,
  );

  const clinicScoreCutoffIso = new Date(
    Date.now() - AI_ANALYSIS_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  await computeAndStoreClinicScoreSnapshot(supabase, business, competitors, clinicScoreCutoffIso, ownThemeTrends);

  const status = taskGeneration.status !== "ok" || themeAnalysis.ownersFailed.length > 0 ? "partial" : "succeeded";

  return {
    ok: true,
    status,
    fetched: scraped.length,
    stored: rows.length,
    ownReviews: rows.filter((r) => r.owner_type === "own").length,
    competitorReviews: rows.filter((r) => r.owner_type === "competitor").length,
    themeAnalysis,
    taskGeneration,
    scrape,
  };
}
