import { type SupabaseClient } from "@supabase/supabase-js";

import { aggregateCompetitorThemes, type AggregatedTheme } from "@/lib/ai-pipeline/aggregate-competitor-themes";
import {
  extractThemes,
  generateExecutiveSummary,
  generateGapAnalysis,
  type CompetitorThemeInput,
  type ReviewInput,
  type ThemeExtractionOutput,
  type ThemeItem,
  type ThemeTrendInput,
} from "@/lib/ai-pipeline/provider";
import {
  computeAnalysisDelta,
  countNewCompetitorReviews,
  type AnalysisDelta,
  type AnalysisDeltaAlert,
  type AnalysisDeltaCompetitorReviewCount,
} from "@/lib/analysis/analysis-delta";
import {
  detectCompetitorAlerts,
  type CompetitorAlert,
  type DetectCompetitorAlertsInput,
} from "@/lib/analysis/competitor-alerts";
import { buildProfileGapCandidates } from "@/lib/analysis/profile-gap-candidates";
import { loadProfileGapStats } from "@/lib/analysis/profile-gap-stats";
import {
  computeAndPersistRecentRatings,
  type RecentRatingsResult,
  type RecentRatingsSnapshot,
} from "@/lib/analysis/recent-ratings";
import { resolveTrustpilotRefs } from "@/lib/analysis/resolve-trustpilot-refs";
import { estimateScrapeCostUsd, type ScrapeMetrics } from "@/lib/analysis/scrape-metrics";
import {
  attachImpactScores,
  canonicalizeCandidateThemes,
  filterCandidates,
  rankCandidates,
  type ScoredTaskCandidate,
} from "@/lib/analysis/task-candidates";
import { refreshTaskOutcomes } from "@/lib/analysis/task-outcomes";
import {
  AI_ANALYSIS_MIN_OWN_REVIEWS_FOR_WINDOW,
  AI_ANALYSIS_WINDOW_DAYS,
  AI_ANALYSIS_WINDOW_DAYS_STEPS,
  MAX_NEW_TASKS_PER_CYCLE,
  MAX_OPEN_TASKS,
  REVIEWS_FETCH_MAX_PER_SOURCE_REF,
  STAGE1_KNOWN_THEME_VOCABULARY_LIMIT,
  THEME_TREND_DELTA_THRESHOLD,
  THEME_TREND_MIN_MENTIONS,
} from "@/lib/constants";
import { recordNotification } from "@/lib/notifications/record-notification";
import { detectAndNotifyThemeSpikes } from "@/lib/notifications/theme-spike";
import { fetchReviewsFromAllSources } from "@/lib/reviews/fetch-all";
import type { ReviewSource, ScrapedSourceReview } from "@/lib/reviews/types";
import { calculateClinicScore, calculateCompetitorRank } from "@/lib/task-engine/clinic-score";
import { derivePriority } from "@/lib/task-engine/priority";
import { selectThemesToReopen } from "@/lib/task-engine/reopen";
import { buildOutcomeMetric, type BuildOutcomeMetricContext } from "@/lib/task-engine/task-outcome";
import { findSimilarTheme, normalizeTheme } from "@/lib/task-engine/theme-similarity";
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

type AnalysisStage = "scraping" | "themes" | "gap" | "tasks" | "summary";

// bkz. docs/05-ai-pipeline.md, docs/03-database.md businesses.analysis_stage —
// UI "Analizi Çalıştır" mutation'ı pending iken bu sütunu poll eder ve
// çevrilebilir bir aşama listesi gösterir. Best-effort: yazım hatası
// pipeline'ı durdurmaz, sadece ilerleme göstergesi eksik kalır.
async function setAnalysisStage(
  supabase: AnalysisSupabaseClient,
  businessId: string,
  stage: AnalysisStage | null,
): Promise<void> {
  const { error } = await supabase.from("businesses").update({ analysis_stage: stage }).eq("id", businessId);

  if (error) {
    console.error("analysis_stage güncellenemedi:", error);
  }
}

// Kaynak-agnostik owner haritası — bkz. docs/02-business-rules.md Bölüm I.
// Google hâlâ birincil/zorunlu kaynaktır ve anahtarı doğrudan
// businesses/competitors.google_place_id'den gelir. Anahtar
// `${source}:${source_ref}` biçimindedir çünkü iki farklı platform aynı ham
// referans/id şemasını paylaşabilir — bu biçim KORUNUR: Trustpilot desteği
// eklendiğinde o kaynağın referansı businesses/competitors tablosundaki
// kendi kolonundan (`trustpilot_domain` — ayrı bir kaynak tablosu YOK, bkz.
// docs/02-business-rules.md Bölüm I) okunup aynı `${source}:${source_ref}`
// formatıyla buraya eklendi; `mapToReviewRows` ve `groupRefsBySource` bu
// formata bağlı çalışır. `trustpilot_domain` çağıran tarafından (executeAnalysis
// içinde resolveTrustpilotRefs ile) önceden çözülmüş halde parametre olarak
// gelir — bu fonksiyon senkron/saf kalır, supabase erişimi yapmaz. export
// edilir: execute-analysis.test.ts Google ve Trustpilot anahtarlama
// davranışını test eder.
export function buildOwnerMap(
  business: { id: string; google_place_id: string; trustpilot_domain?: string | null },
  competitors: { id: string; google_place_id: string; trustpilot_domain?: string | null }[],
): Map<string, OwnerRef> {
  const ownerBySourceRef = new Map<string, OwnerRef>();
  ownerBySourceRef.set(`google:${business.google_place_id}`, { owner_type: "own", business_id: business.id });
  if (business.trustpilot_domain) {
    ownerBySourceRef.set(`trustpilot:${business.trustpilot_domain}`, {
      owner_type: "own",
      business_id: business.id,
    });
  }
  for (const competitor of competitors) {
    ownerBySourceRef.set(`google:${competitor.google_place_id}`, {
      owner_type: "competitor",
      business_id: competitor.id,
    });
    if (competitor.trustpilot_domain) {
      ownerBySourceRef.set(`trustpilot:${competitor.trustpilot_domain}`, {
        owner_type: "competitor",
        business_id: competitor.id,
      });
    }
  }

  return ownerBySourceRef;
}

function mapToReviewRows(
  scraped: ScrapedSourceReview[],
  ownerBySourceRef: Map<string, OwnerRef>,
): TablesInsert<"reviews">[] {
  // Apify aynı yorumu tek çalıştırmada birden fazla kez döndürebiliyor; tek
  // upsert komutunda mükerrer (source, source_ref, review_id) Postgres 21000
  // ("cannot affect row a second time") hatası verir — batch içinde dedup şart.
  const rows = new Map<string, TablesInsert<"reviews">>();
  for (const review of scraped) {
    const owner = ownerBySourceRef.get(`${review.source}:${review.source_ref}`);
    if (!owner) {
      continue;
    }
    rows.set(`${review.source}:${review.source_ref}:${review.review_id}`, { ...review, ...owner });
  }
  return Array.from(rows.values());
}

// Owner haritasındaki anahtarları (`${source}:${source_ref}`) kaynağa göre
// gruplar — fetchReviewsFromAllSources'un beklediği Map<ReviewSource,
// string[]> girdisini üretir.
function groupRefsBySource(ownerBySourceRef: Map<string, OwnerRef>): Map<ReviewSource, string[]> {
  const refsBySource = new Map<ReviewSource, string[]>();
  for (const key of ownerBySourceRef.keys()) {
    const separatorIndex = key.indexOf(":");
    const source = key.slice(0, separatorIndex) as ReviewSource;
    const ref = key.slice(separatorIndex + 1);
    const existing = refsBySource.get(source);
    if (existing) {
      existing.push(ref);
    } else {
      refsBySource.set(source, [ref]);
    }
  }
  return refsBySource;
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

// bkz. docs/05-ai-pipeline.md "known-theme vocabulary" — own çağrısı own'un
// kendi önceki etiketlerini, her rakip çağrısı ise önceki döngünün AGREGAT
// rakip etiketlerini (tek tek rakibin değil — bkz. fetchPreviousThemeData)
// alır; böylece etiketler hem döngüler arasında hem de aynı döngüdeki
// rakipler arasında tutarlı kalır.
async function runStage1ForOwners(
  owners: OwnerInfo[],
  reviewsByOwnerId: Map<string, ReviewInput[]>,
  outputLanguage: string,
  windowDays: number,
  ownKnownThemes: string[],
  competitorKnownThemes: string[],
): Promise<Stage1Result[]> {
  return Promise.all(
    owners.map(async (owner): Promise<Stage1Result> => {
      const reviews = reviewsByOwnerId.get(owner.id) ?? [];
      const knownThemes = owner.ownerType === "own" ? ownKnownThemes : competitorKnownThemes;
      const result = await withRetryOnce(() =>
        extractThemes({
          businessName: owner.name,
          category: owner.category,
          reviews,
          outputLanguage,
          windowDays,
          knownThemes,
        }),
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
  // Rakip bazlı (competitor_id dolu) tema satırları — competitor-alerts.ts
  // competitor_negative_spike girdisi için (bkz. runAnalysisPipeline). Görev
  // kartı kanıt satırı için zaten hesaplanıyordu (perCompetitorRows), burada
  // sadece DIŞARI da döndürülüyor — hesaplama DEĞİŞMEDİ.
  perCompetitorThemeRows: ThemeTrendInput[];
}

interface MentionCounts {
  positive_mentions: number;
  negative_mentions: number;
}

// bkz. docs/02-business-rules.md Bölüm C — trend AI değil kod tarafında,
// döngüler arası negatif oran deltasından hesaplanır. Önceki döngüde tema yoksa
// trend null kalır. BURADA BİLİNÇLİ OLARAK yalnızca exact (normalize edilmiş)
// eşleşme kullanılır — theme-similarity.ts'teki fuzzy güvenlik ağı buraya
// KASITLI OLARAK eklenmedi (Faz 2.8'de trend/scoring semantiği bilinçli olarak
// değiştirilmedi). Model artık aynı konu için etiketi tekrar kullanmaya
// yönlendiriliyor (bkz. docs/05-ai-pipeline.md "known-theme vocabulary",
// fetchPreviousThemeData) — bu, eşleşmenin döngüler arası kaçma olasılığını
// asıl kaynağında azaltır; eşleşme yine de kaçarsa trend null kalmaya devam
// eder (bilinçli sınırlama).
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

interface PreviousThemeData {
  counts: Map<string, MentionCounts>;
  // bkz. docs/05-ai-pipeline.md "known-theme vocabulary" — Aşama 1'e geçirilen
  // sözlükler, en çok bahsedilen temadan başlayarak en fazla
  // STAGE1_KNOWN_THEME_VOCABULARY_LIMIT adet (prompt boyutunu sınırlamak için).
  ownVocabulary: string[];
  // Sadece toplulaştırılmış (competitor_id NULL) satırlardan — rakip bazlı
  // satırlar (competitor_id dolu) dahil edilmez, aksi halde aynı tema N rakip
  // kadar tekrar sayılıp sıralamayı bozar.
  competitorAggregateVocabulary: string[];
}

// En çok bahsedilen (positive+negative toplamı en yüksek) temadan başlayarak
// sınırlar — bkz. STAGE1_KNOWN_THEME_VOCABULARY_LIMIT. `pinnedLabels` (bkz.
// docs/05-ai-pipeline.md "tema kanonikleştirme" — açık görev etiketleri) HER
// ZAMAN listeye dahil edilir ve KAPSAM DIŞI tutulur: bir tema hâlâ açık bir
// görevin etiketiyse, o etiket cap yüzünden sözlükten düşerse görev bir
// sonraki döngüde sessizce "absent" a düşebilir (bkz. task-outcome.ts). Cap
// yalnızca pinned olmayan kalanı (mention sayısına göre sıralı) sınırlar.
// export edilir: execute-analysis.test.ts pin/cap etkileşimini doğrudan test eder.
export function buildThemeVocabulary(rows: { theme: string; total: number }[], pinnedLabels: string[] = []): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const label of pinnedLabels) {
    const key = normalizeTheme(label);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(label);
    }
  }

  const sortedRows = [...rows].sort((a, b) => b.total - a.total);
  for (const row of sortedRows) {
    if (result.length >= STAGE1_KNOWN_THEME_VOCABULARY_LIMIT) {
      break;
    }
    const key = normalizeTheme(row.theme);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(row.theme);
  }

  return result;
}

// Önceki döngünün satırları delete-then-reinsert ile silineceği için hem trend
// karşılaştırma verisi (counts) hem de Aşama 1'e geçirilecek known-theme
// sözlükleri (ownVocabulary/competitorAggregateVocabulary — bkz.
// docs/05-ai-pipeline.md) AYNI sorguda, delete'lerden ÖNCE okunur. Bu yüzden
// (trend hesabının aksine) bu fonksiyon artık Stage 1 çağrılarından ÖNCE
// çalıştırılır (bkz. runAnalysisPipeline) — counts, persistThemeSummary'ye
// parametre olarak geçirilir.
async function fetchPreviousThemeData(
  supabase: AnalysisSupabaseClient,
  businessId: string,
): Promise<PreviousThemeData> {
  const [{ data }, { data: openTasks }] = await Promise.all([
    supabase
      .from("theme_summary")
      .select("owner_type, competitor_id, theme, positive_mentions, negative_mentions")
      .eq("business_id", businessId),
    // bkz. docs/05-ai-pipeline.md "tema kanonikleştirme" — bir tema hâlâ AÇIK
    // bir görevin etiketiyse, sadece bir önceki döngünün en çok bahsedilen
    // STAGE1_KNOWN_THEME_VOCABULARY_LIMIT temasına dayanan sözlük onu es
    // geçebilir (mention sayısı düşükse cap'ten düşer) ve görev bir sonraki
    // döngüde sessizce "absent" a düşebilir. Bu yüzden açık görevlerin
    // etiketleri sözlüğe PIN'lenir (cap tarafından düşürülmez, bkz.
    // buildThemeVocabulary). `profile:*` anahtarları (profile_gap görevleri)
    // AI'a hiç gösterilmeyen sabit dahili anahtarlardır, hariç tutulur.
    //
    // PIN HEM own HEM rakip sözlüğüne uygulanır: `competitive_gap` görevlerinin
    // teması RAKİP tarafından doğar (klinik o temada zaten sessizdir — fark
    // budur), dolayısıyla yalnızca own sözlüğüne pin'lemek onları korumaz.
    // Gerçek pilotta (2026-08, 5. döngü) tam olarak bu yaşandı: "Çocuklarla
    // iletişim ve diş korkusunun yenilmesi" açık bir görevken rakip tarafı
    // "Çocuk hastalarda diş korkusunun giderilmesi" diye yeniden adlandırıldı
    // ve ikinci bir kopya görev üretildi (benzerlik ağı 0.43 ile 0.6 eşiğinin
    // altında kaldı). Aynı etiketi iki sözlükte de göstermek ucuzdur ve
    // sağlayıcı değişse bile (Claude -> Gemini) etiketi sabit tutar.
    supabase.from("tasks").select("theme").eq("business_id", businessId).eq("status", "open"),
  ]);

  const counts = new Map<string, MentionCounts>();
  const ownRows: { theme: string; total: number }[] = [];
  const competitorAggregateRows: { theme: string; total: number }[] = [];

  for (const row of data ?? []) {
    counts.set(`${row.owner_type}|${row.competitor_id ?? "agg"}|${normalizeTheme(row.theme)}`, row);
    const total = row.positive_mentions + row.negative_mentions;
    if (row.owner_type === "own") {
      ownRows.push({ theme: row.theme, total });
    } else if (row.owner_type === "competitor" && row.competitor_id === null) {
      competitorAggregateRows.push({ theme: row.theme, total });
    }
  }

  const openTaskThemes = (openTasks ?? [])
    .map((t) => t.theme)
    .filter((theme): theme is string => theme !== null && !theme.startsWith("profile:"));

  return {
    counts,
    ownVocabulary: buildThemeVocabulary(ownRows, openTaskThemes),
    competitorAggregateVocabulary: buildThemeVocabulary(competitorAggregateRows, openTaskThemes),
  };
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
  // bkz. fetchPreviousThemeData — artık burada değil, Stage 1 çağrılarından
  // ÖNCE (runAnalysisPipeline) okunur (known-theme vocabulary ihtiyacı için);
  // trend hesabı aynı veriyi burada parametre olarak alır, davranış DEĞİŞMEDİ.
  previousCounts: Map<string, MentionCounts>,
): Promise<ThemeSummaryPersistResult> {
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

  let perCompetitorThemeRows: ThemeTrendInput[] = [];
  if (hasCompetitorData) {
    // Toplulaştırılmış satır (competitor_id = NULL) — skorlama/filtreleme/
    // bildirim/Themes-sayfası bunu okumaya devam eder, davranış DEĞİŞMEDİ.
    const aggregatedRows = toThemeTrendRows(competitorAggregated, "competitor", previousCounts);
    // Rakip bazlı satırlar (competitor_id dolu) — sadece görev kartı kanıt
    // satırı ("N rakibinden M'i güçlü") ve competitor-alerts.ts
    // competitor_negative_spike girdisi için. `aggregateCompetitorThemes`
    // tek rakiplik girdiyle çağrılır — o rakibin kendi mention kırılımını verir.
    perCompetitorThemeRows = succeededCompetitors.flatMap((r) =>
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
      [...aggregatedRows, ...perCompetitorThemeRows],
      periodStart,
      periodEnd,
    );
  }

  return { ownAggregated, competitorAggregated, hasCompetitorData, ownThemeTrends, previousCounts, perCompetitorThemeRows };
}

// bkz. docs/02-business-rules.md Bölüm E — `dismissed` bir görev, aynı temada
// negatif mention sayısı bir önceki döngüye göre 2x artarsa yeniden `open`
// olur. Bu adım upsertTasks'tan ÖNCE çalışmalı ki reopen edilen görevler
// upsertTasks tarafından mevcut "open" görev olarak eşleşip güncellensin,
// tekrar yeni satır olarak eklenmesin. Dönüş değeri (reopen edilen görev
// sayısı) sadece analiz delta kartı için taşınır (bkz. analysis-delta.ts) —
// reopen mantığının kendisini etkilemez.
async function reopenBurstingDismissedTasks(
  supabase: AnalysisSupabaseClient,
  businessId: string,
  previousCounts: Map<string, MentionCounts>,
  ownAggregated: AggregatedTheme[],
): Promise<number> {
  const themesToReopen = selectThemesToReopen(previousCounts, ownAggregated);
  if (themesToReopen.length === 0) {
    return 0;
  }

  const { data: dismissedTasks, error: selectError } = await supabase
    .from("tasks")
    .select("id, theme")
    .eq("business_id", businessId)
    .eq("status", "dismissed");

  if (selectError) {
    console.error("Failed to reopen dismissed tasks on negative mention burst:", selectError);
    return 0;
  }

  const normalizedThemesToReopen = new Set(themesToReopen.map(normalizeTheme));
  const matchedIds = dismissedTasks
    .filter((task) => task.theme !== null && normalizedThemesToReopen.has(normalizeTheme(task.theme)))
    .map((task) => task.id);

  if (matchedIds.length === 0) {
    return 0;
  }

  const { error } = await supabase
    .from("tasks")
    .update({ status: "open", last_priority_recalc_at: new Date().toISOString() })
    .in("id", matchedIds);

  if (error) {
    console.error("Failed to reopen dismissed tasks on negative mention burst:", error);
    return 0;
  }

  return matchedIds.length;
}

// export edilir: execute-analysis.test.ts fuzzy dedup (theme-similarity.ts
// güvenlik ağı, Faz 2.8) davranışını doğrudan test eder.
export async function upsertTasks(
  supabase: AnalysisSupabaseClient,
  businessId: string,
  candidates: ScoredTaskCandidate[],
  outcomeCtx: BuildOutcomeMetricContext,
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  // bkz. docs/02-business-rules.md Bölüm D "Açık görev tavanı",
  // docs/01-product-vision.md — ürünün vaadi "az sayıda, tamamlanabilir görev".
  // Döngü başına 5 yeni görev sınırı toplamı sınırlamıyordu: kullanıcı hiçbir
  // şeyi tamamlamazsa liste her döngüde büyür ve "rapor okuma" deneyimine geri
  // döner (gerçek pilotta 6 döngüde 15 açık göreve ulaştı). Tavana ulaşıldığında
  // YENİ görev üretilmez; mevcut açık görevlerin güncellenmesi (skor/öncelik
  // tazeleme) her zaman sürer, yani liste bayatlamaz — kullanıcı bir görevi
  // tamamladıkça/reddettikçe yer açılır ve bir sonraki döngüde en güçlü aday
  // yükselir.
  const { count: openTaskCount } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("status", "open");
  let openTasks = openTaskCount ?? 0;

  for (const candidate of candidates) {
    const priority = derivePriority(candidate.impact_score, candidate.effort_score);

    const { data: exactMatch } = await supabase
      .from("tasks")
      .select("id")
      .eq("business_id", businessId)
      .eq("theme", candidate.theme)
      .eq("source_type", candidate.source_type)
      .eq("status", "open")
      .maybeSingle();

    let existingId = exactMatch?.id ?? null;

    // bkz. docs/02-business-rules.md Bölüm D, src/lib/task-engine/theme-similarity.ts
    // — exact dedup kaçarsa (Aşama 1 modeli aynı temayı bu döngüde hafifçe
    // farklı adlandırmışsa; birincil savunma known-theme vocabulary'dir, bkz.
    // docs/05-ai-pipeline.md, ama bu bir güvenlik ağıdır) aynı source_type
    // içindeki AÇIK görevler arasında morfolojik olarak benzer bir tema aranır.
    // Bulunursa o görev candidate'in GÜNCEL skor/başlık/açıklamasıyla
    // güncellenir — theme kolonu ve outcome_baseline (görevin kendi geçmişi)
    // BİLİNÇLİ OLARAK dokunulmadan kalır (aşağıdaki UPDATE payload'ında ikisi
    // de yok), aksi halde iki döngü arasında sadece etiket kaydığı için aynı
    // konuyu takip eden görev sanki yeni doğmuş gibi baseline'ını kaybederdi.
    if (!existingId) {
      const { data: openSameSourceType } = await supabase
        .from("tasks")
        .select("id, theme")
        .eq("business_id", businessId)
        .eq("source_type", candidate.source_type)
        .eq("status", "open");

      const openThemeLabels = (openSameSourceType ?? [])
        .map((t) => t.theme)
        .filter((theme): theme is string => theme !== null);
      const similarLabel = findSimilarTheme(candidate.theme, openThemeLabels);
      existingId = similarLabel
        ? ((openSameSourceType ?? []).find((t) => t.theme === similarLabel)?.id ?? null)
        : null;
    }

    // Kota yalnızca yeni oluşturmaları sınırlar; güncellemeler (exact ya da
    // fuzzy eşleşme) her zaman işlenir (skor/öncelik taze kalsın). Liste skor
    // sıralı geldiği için "ilk 5 yeni" = en yüksek fırsat skorlu 5 yeni aday.
    if (!existingId && (created >= MAX_NEW_TASKS_PER_CYCLE || openTasks >= MAX_OPEN_TASKS)) {
      continue;
    }

    if (existingId) {
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
        .eq("id", existingId);
      updated += 1;
    } else {
      // bkz. supabase/migrations/20260823000400_tasks_outcome.sql, docs/09-task-engine.md
      // "Görev sonuç takibi" — görev ilk oluştuğu andaki ölçülebilir sinyal
      // durumu (baseline) burada donar; sonraki döngülerde SADECE outcome_latest
      // güncellenir (bkz. refreshTaskOutcomes), baseline bir daha yazılmaz ki
      // "işe yaradı mı?" kıyası hep aynı başlangıç noktasına göre kalsın.
      const outcomeBaseline = buildOutcomeMetric(candidate, outcomeCtx);
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
        outcome_baseline: outcomeBaseline,
      });
      // bkz. docs/02-business-rules.md Bölüm G kural 1 — yeni görev
      // oluştuğunda anlık değil, haftalık özete dahil edilecek şekilde kaydedilir.
      await recordNotification(supabase, {
        businessId,
        type: "competitor_review_delta",
        payload: { theme: candidate.theme, title_i18n: candidate.title },
      });
      created += 1;
      openTasks += 1;
    }
  }

  return { created, updated };
}

interface TaskGenerationSummary {
  status: "ok" | "skipped_own_failed" | "skipped_stage2_failed";
  created: number;
  updated: number;
  // Stage 2 filterCandidates çıktısının uzunluğu — sadece analiz delta
  // kartındaki zero_new_tasks_reason ayrımı için (bkz. analysis-delta.ts),
  // skorlama/kota mantığını etkilemez.
  filteredCount: number;
}

// bkz. docs/02-business-rules.md Bölüm D üçüncü kaynak — profile_gap adayları
// AI'a bağımlı değildir; Stage 1 (own) ya da Stage 2 başarısız olsa bile tek
// başlarına upsert edilir (deterministik görevler AI başarısına bağlı olmamalı).
async function upsertProfileGapOnly(
  supabase: AnalysisSupabaseClient,
  businessId: string,
  status: Exclude<TaskGenerationSummary["status"], "ok">,
  profileGapCandidates: ScoredTaskCandidate[],
  outcomeCtx: BuildOutcomeMetricContext,
): Promise<TaskGenerationSummary> {
  const ranked = rankCandidates(profileGapCandidates);
  const { created, updated } = await upsertTasks(supabase, businessId, ranked, outcomeCtx);
  return { status, created, updated, filteredCount: 0 };
}

async function runStage2AndUpsertTasks(
  supabase: AnalysisSupabaseClient,
  businessId: string,
  ownThemes: ThemeItem[] | null,
  competitorStage1Results: Stage1Result[],
  aggregates: Omit<ThemeSummaryPersistResult, "hasCompetitorData"> & { hasCompetitorData: boolean },
  profileGapCandidates: ScoredTaskCandidate[],
  outcomeCtx: BuildOutcomeMetricContext,
): Promise<TaskGenerationSummary> {
  if (!ownThemes) {
    return upsertProfileGapOnly(supabase, businessId, "skipped_own_failed", profileGapCandidates, outcomeCtx);
  }

  const competitorsForStage2: CompetitorThemeInput[] = competitorStage1Results
    .filter(hasResult)
    .map((r) => ({ id: r.owner.id, name: r.owner.name, themes: r.result.themes }));

  const stage2Result = await withRetryOnce(() =>
    generateGapAnalysis({ ownThemes, competitors: competitorsForStage2 }),
  );

  if (!stage2Result) {
    return upsertProfileGapOnly(supabase, businessId, "skipped_stage2_failed", profileGapCandidates, outcomeCtx);
  }

  await setAnalysisStage(supabase, businessId, "tasks");
  // bkz. docs/05-ai-pipeline.md "tema kanonikleştirme" — promptun "theme'i
  // verbatim kopyala" kuralına rağmen modele güvenilmez; filterCandidates'a
  // (own/rakip tema eşleştirmesi normalize edilmiş exact match ile çalışır)
  // girmeden ÖNCE aday temaları known-label kümesine kanonikleştirilir.
  const canonicalizedTasks = canonicalizeCandidateThemes(
    stage2Result.tasks,
    aggregates.ownAggregated,
    aggregates.competitorAggregated,
  );
  const filtered = filterCandidates(
    canonicalizedTasks,
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
  // Profil farkı adayları AI adaylarıyla BİRLİKTE, rankCandidates'tan ÖNCE
  // birleştirilir ki MAX_NEW_TASKS_PER_CYCLE kotası için adil rekabet etsinler
  // (bkz. docs/02-business-rules.md Bölüm D).
  const ranked = rankCandidates([...scored, ...profileGapCandidates]);
  const { created, updated } = await upsertTasks(supabase, businessId, ranked, outcomeCtx);

  return { status: "ok", created, updated, filteredCount: filtered.length };
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
  // Faz 2.7 — bkz. src/lib/analysis/recent-ratings.ts. Resmi `rating`
  // (yukarıdaki competitor_rank hesabı) DEĞİŞMEDEN, aynı satıra ayrıca
  // "canlı puan" anlık görüntüsü yazılır (Trend grafiği own vs rakip-medyan
  // canlı puan serisini buradan okur — bkz. docs/08-dashboard.md).
  recentRatingsSnapshot: RecentRatingsSnapshot | null,
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
    recent_ratings: recentRatingsSnapshot as unknown as Json,
  });

  if (error) {
    console.error("Failed to store clinic_score_history snapshot:", error);
  }
}

// bkz. docs/02-business-rules.md Bölüm G kural 4/5/6, src/lib/analysis/
// competitor-alerts.ts, src/lib/analysis/recent-ratings.ts. Girdi üç ayrı
// kaynaktan derlenir: bu döngüdeki yeni yorum sayısı (analysis-delta.ts
// countNewCompetitorReviews — TÜM rakipler, delta kartındaki top-3
// kesintisine tabi DEĞİL), canlı puan önce/sonra (recent-ratings.ts) ve
// rakip bazlı negatif mention önce/sonra (persistThemeSummary'nin
// perCompetitorThemeRows'u + previousCounts).
function buildCompetitorAlertInput(
  competitors: { id: string; name: string }[],
  competitorNewReviewCounts: AnalysisDeltaCompetitorReviewCount[],
  windowDays: number,
  recentRatings: RecentRatingsResult,
  perCompetitorThemeRows: ThemeTrendInput[],
  previousCounts: Map<string, MentionCounts>,
  previousRunAt: string | null,
): DetectCompetitorAlertsInput {
  // bkz. competitor-alerts.ts cycleDays — ilk analizde null (surge kuralı
  // atlanır), sonrasında önceki analizden bu yana geçen gün (en az 1).
  const cycleDays =
    previousRunAt === null
      ? null
      : Math.max(1, (Date.now() - new Date(previousRunAt).getTime()) / (24 * 60 * 60 * 1000));
  const newReviewsByCompetitorId = new Map(competitorNewReviewCounts.map((c) => [c.competitor_id, c.count]));
  const recentRatingByCompetitorId = new Map(recentRatings.competitors.map((c) => [c.id, c]));

  const themeRowsByCompetitorId = new Map<string, ThemeTrendInput[]>();
  for (const row of perCompetitorThemeRows) {
    if (!row.competitor_id) {
      continue;
    }
    const list = themeRowsByCompetitorId.get(row.competitor_id) ?? [];
    list.push(row);
    themeRowsByCompetitorId.set(row.competitor_id, list);
  }

  return {
    competitors: competitors.map((c) => {
      const recentRating = recentRatingByCompetitorId.get(c.id);
      const negativeThemeSpikes = (themeRowsByCompetitorId.get(c.id) ?? []).map((row) => ({
        theme: row.theme,
        previousNegative:
          previousCounts.get(`competitor|${c.id}|${normalizeTheme(row.theme)}`)?.negative_mentions ?? 0,
        currentNegative: row.negative_mentions,
      }));
      const reviewsInWindow = recentRating?.current.reviews ?? 0;

      return {
        id: c.id,
        name: c.name,
        newReviewsThisCycle: newReviewsByCompetitorId.get(c.id) ?? 0,
        avgMonthlyReviews: windowDays > 0 ? (reviewsInWindow / windowDays) * 30 : 0,
        cycleDays,
        previousRecentRating: recentRating?.previous?.rating ?? null,
        currentRecentRating: recentRating?.current.rating ?? null,
        negativeThemeSpikes,
      };
    }),
  };
}

// Her alert bir `notifications` satırı olarak kaydedilir (haftalık özet
// bunları toplar — bkz. weekly-digest.ts) ve AnalysisDelta.alerts için
// hafifletilmiş bir şekle indirgenir (competitor_id olmadan — kart yalnızca
// isim gösterir).
async function recordCompetitorAlerts(
  supabase: AnalysisSupabaseClient,
  businessId: string,
  alerts: CompetitorAlert[],
): Promise<AnalysisDeltaAlert[]> {
  for (const alert of alerts) {
    await recordNotification(supabase, {
      businessId,
      type: alert.type,
      payload: { competitor_id: alert.competitor_id, competitor_name: alert.competitor_name, ...alert.detail },
    });
  }
  return alerts.map((alert) => ({ type: alert.type, competitor_name: alert.competitor_name, detail: alert.detail }));
}

async function runAnalysisPipeline(
  supabase: AnalysisSupabaseClient,
  business: { id: string; name: string; category: string | null; website: string | null },
  competitors: { id: string; name: string; website: string | null }[],
  outputLanguage: string,
  notifyContext: { isPro: boolean; ownerEmail: string | null },
  previousRunAt: string | null,
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

  await setAnalysisStage(supabase, business.id, "themes");
  // bkz. docs/05-ai-pipeline.md "known-theme vocabulary" — önceki döngünün
  // theme_summary satırları bu döngüde SİLİNECEĞİ için (persistThemeSummary
  // içindeki replaceThemeSummaryRows), hem trend karşılaştırma verisi hem de
  // Aşama 1'e geçirilecek etiket sözlükleri Stage 1 çağrılarından ÖNCE, TEK
  // sorguda okunur.
  const previousThemeData = await fetchPreviousThemeData(supabase, business.id);

  // bkz. src/lib/analysis/recent-ratings.ts — own+rakip Aşama 1 tema
  // analiziyle bağımsız, aynı anda çalıştırılır (ikisi de sadece bu
  // döngünün pencere içindeki yorumlarını okur). Önceki recent_rating
  // değerleri bu çağrı içinde UPDATE'ten ÖNCE okunur (rakip uyarıları
  // competitor_rating_shift için gerekli).
  const [stage1Results, recentRatings] = await Promise.all([
    runStage1ForOwners(
      owners,
      reviewsByOwnerId,
      outputLanguage,
      windowDays,
      previousThemeData.ownVocabulary,
      previousThemeData.competitorAggregateVocabulary,
    ),
    computeAndPersistRecentRatings(supabase, business, competitors, cutoffIso, windowDays),
  ]);
  const ownStage1 = stage1Results.find((r) => r.owner.ownerType === "own") ?? null;
  const competitorStage1Results = stage1Results.filter((r) => r.owner.ownerType === "competitor");

  const aggregates = await persistThemeSummary(
    supabase,
    business.id,
    ownStage1?.result ?? null,
    competitorStage1Results,
    periodStart,
    periodEnd,
    previousThemeData.counts,
  );

  const tasksReopened = await reopenBurstingDismissedTasks(
    supabase,
    business.id,
    aggregates.previousCounts,
    aggregates.ownAggregated,
  );

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

  // bkz. docs/02-business-rules.md Bölüm D üçüncü kaynak — deterministik
  // profil farkı adayları, Stage 1/2'den bağımsız olarak burada hesaplanır;
  // aşağıda runStage2AndUpsertTasks içinde AI adaylarıyla birleştirilir ya da
  // (AI başarısızsa) tek başına upsert edilir.
  const profileGapStats = await loadProfileGapStats(supabase, business, competitors, cutoffIso, windowDays);
  const profileGapCandidates = buildProfileGapCandidates(profileGapStats);

  // bkz. docs/09-task-engine.md "Görev sonuç takibi" — yeni oluşturulan
  // görevlerin baseline'ı (upsertTasks) ve mevcut görevlerin en güncel ölçümü
  // (refreshTaskOutcomes, aşağıda) AYNI ctx'ten üretilir ki iki ölçüm de aynı
  // anlık görüntüyü (own tema kırılımı, yanıt oranı, website) referans alsın.
  const outcomeCtx: BuildOutcomeMetricContext = {
    ownAggregated: aggregates.ownAggregated,
    ownReply: { total: profileGapStats.own.total, replied: profileGapStats.own.replied },
    ownWebsite: profileGapStats.own.website,
    measuredAt: now.toISOString(),
    windowDays,
  };

  await setAnalysisStage(supabase, business.id, "gap");
  const taskGeneration = await runStage2AndUpsertTasks(
    supabase,
    business.id,
    ownStage1?.result?.themes ?? null,
    competitorStage1Results,
    aggregates,
    profileGapCandidates,
    outcomeCtx,
  );

  // Yeni görevler yukarıda kendi baseline'ını insert sırasında aldı; burada
  // TÜM open/done görevler için outcome_latest tazelenir (mevcut görevlerin
  // "işe yaradı mı?" kıyası güncel kalsın) — bkz. src/lib/analysis/task-outcomes.ts.
  await refreshTaskOutcomes(supabase, business.id, outcomeCtx);

  // bkz. docs/05-ai-pipeline.md "Delta adımı" — Aşama 2/görev üretiminden
  // sonra, aynı analiz isteği içinde hesaplanır ve analysis_runs.delta'ya
  // yazılmak üzere döndürülür (bkz. run-manual-analysis.ts, run-cron-analysis-cycle.ts).
  // Rakip başına yeni yorum sayısı burada TEK sefer hesaplanır — hem delta'nın
  // top-3 listesi (competitorNewReviewsByCompetitor param'ı) hem de aşağıdaki
  // competitor_review_surge uyarısı (TÜM rakipler) aynı sonucu paylaşır.
  const competitorNewReviewCounts = await countNewCompetitorReviews(
    supabase,
    competitors,
    previousRunAt ?? cutoffIso,
  );
  const delta = await computeAnalysisDelta(supabase, {
    businessId: business.id,
    competitors,
    windowDays,
    previousRunAt,
    windowStartIso: cutoffIso,
    tasksCreated: taskGeneration.created,
    tasksUpdated: taskGeneration.updated,
    tasksReopened,
    ownThemeTrends: aggregates.ownThemeTrends,
    taskGenerationStatus: taskGeneration.status,
    filteredCandidateCount: taskGeneration.filteredCount,
    competitorNewReviewsByCompetitor: competitorNewReviewCounts,
  });

  // bkz. docs/02-business-rules.md Bölüm G kural 4/5/6 — delta hesaplandıktan
  // SONRA, aynı per-competitor yeni yorum verisi + canlı puan + tema
  // kırılımından rakip uyarıları türetilir; her biri bir bildirim satırı
  // olarak kaydedilir (haftalık özete dahil olur) ve delta.alerts'e eklenir.
  const competitorAlerts = detectCompetitorAlerts(
    buildCompetitorAlertInput(
      competitors,
      competitorNewReviewCounts,
      windowDays,
      recentRatings,
      aggregates.perCompetitorThemeRows,
      aggregates.previousCounts,
      previousRunAt,
    ),
  );
  const deltaAlerts = await recordCompetitorAlerts(supabase, business.id, competitorAlerts);
  const deltaWithAlerts: AnalysisDelta = deltaAlerts.length > 0 ? { ...delta, alerts: deltaAlerts } : delta;

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
    delta: deltaWithAlerts,
    recentRatingsSnapshot: recentRatings.snapshot,
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
      delta: AnalysisDelta;
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
    website: string | null;
    trustpilot_domain: string | null;
    trustpilot_checked_at: string | null;
    // Analiz delta kartı için "önceki koşu" referansı — bu fonksiyonun
    // aşağıda `last_scraped_at`'i kendi güncellemesinden ÖNCEki (çağıran
    // tarafın DB'den okuduğu) değer olmalı (bkz. analysis-delta.ts previous_run_at
    // notu). run-manual-analysis.ts ve run-cron-analysis-cycle.ts bunu business
    // satırını fetch ederken zaten okuyor.
    last_scraped_at: string | null;
  },
  competitors: {
    id: string;
    google_place_id: string;
    name: string;
    rating: number | null;
    website: string | null;
    trustpilot_domain: string | null;
    trustpilot_checked_at: string | null;
  }[],
  outputLanguage: string,
  notifyContext: { isPro: boolean; ownerEmail: string | null },
  options?: { apifyTimeoutMs?: number },
): Promise<ExecuteAnalysisResult> {
  const apifyTimeoutMs = options?.apifyTimeoutMs ?? DEFAULT_APIFY_TIMEOUT_MS;
  // Bu fonksiyon aşağıda `businesses.last_scraped_at`'i günceller (scrape
  // başarılı olduktan hemen sonra) — analiz delta kartının "önceki koşu"
  // referansı için o güncellemeden ÖNCEki değer burada yakalanır.
  const previousRunAt = business.last_scraped_at;

  // Trustpilot sadece Pro planda çalışır (bkz. docs/02-business-rules.md
  // "Trustpilot'a özgü kurallar"). Pro olmayan kullanıcılarda
  // resolveTrustpilotRefs hiç çağrılmaz — gereksiz probe/Apify çağrısı olmaz.
  const trustpilotRefs = notifyContext.isPro
    ? await resolveTrustpilotRefs(supabase, business, competitors, { timeoutMs: apifyTimeoutMs })
    : { ownDomain: null, byCompetitorId: new Map<string, string>() };

  const ownerBySourceRef = buildOwnerMap(
    { id: business.id, google_place_id: business.google_place_id, trustpilot_domain: trustpilotRefs.ownDomain },
    competitors.map((competitor) => ({
      id: competitor.id,
      google_place_id: competitor.google_place_id,
      trustpilot_domain: trustpilotRefs.byCompetitorId.get(competitor.id) ?? null,
    })),
  );
  const refsBySource = groupRefsBySource(ownerBySourceRef);

  // bkz. docs/03-database.md businesses.analysis_stage — bu fonksiyonun her
  // dönüş yolu (başarı, kısmi başarı, erken hata) finally bloğunda stage'i
  // NULL'a döndürür ki UI göstergesi asla takılı kalmasın.
  await setAnalysisStage(supabase, business.id, "scraping");
  try {
    // bkz. docs/11-risks-assumptions.md Risk 3 — scrape başarı/maliyet/latency
    // ölçümü; yalnızca gözlem, akış davranışını değiştirmez.
    const scrapeStartedAt = Date.now();
    let scraped: ScrapedSourceReview[];
    try {
      scraped = await fetchReviewsFromAllSources(refsBySource, REVIEWS_FETCH_MAX_PER_SOURCE_REF, {
        timeoutMs: apifyTimeoutMs,
      });
    } catch (apifyError) {
      console.error("Yorum çekme başarısız:", apifyError);
      return {
        ok: false,
        error: "apify_call_failed",
        scrape: { success: false, fetchedReviews: null, latencyMs: Date.now() - scrapeStartedAt, costUsd: null },
      };
    }

    const countsBySource = new Map<ReviewSource, number>();
    for (const review of scraped) {
      countsBySource.set(review.source, (countsBySource.get(review.source) ?? 0) + 1);
    }

    const scrape: ScrapeMetrics = {
      success: true,
      fetchedReviews: scraped.length,
      latencyMs: Date.now() - scrapeStartedAt,
      costUsd: estimateScrapeCostUsd(countsBySource),
    };

    const rows = mapToReviewRows(scraped, ownerBySourceRef);

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from("reviews")
        .upsert(rows, { onConflict: "source,source_ref,review_id" });

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

    const { themeAnalysis, taskGeneration, ownThemeTrends, delta, recentRatingsSnapshot } = await runAnalysisPipeline(
      supabase,
      { id: business.id, name: business.name, category: business.category, website: business.website },
      competitors,
      outputLanguage,
      notifyContext,
      previousRunAt,
    );

    await setAnalysisStage(supabase, business.id, "summary");
    const clinicScoreCutoffIso = new Date(
      Date.now() - AI_ANALYSIS_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    await computeAndStoreClinicScoreSnapshot(
      supabase,
      business,
      competitors,
      clinicScoreCutoffIso,
      ownThemeTrends,
      recentRatingsSnapshot,
    );

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
      delta,
    };
  } finally {
    await setAnalysisStage(supabase, business.id, null);
  }
}
