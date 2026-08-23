import { type SupabaseClient } from "@supabase/supabase-js";

import type { ThemeTrendInput } from "@/lib/ai-pipeline/provider";
import type { Database, Json, TablesUpdate } from "@/types/database.types";

// bkz. docs/05-ai-pipeline.md "Delta adımı", docs/08-dashboard.md — her analiz
// koşusunun bir önceki (succeeded/partial) koşuya göre yapılandırılmış özeti.
// `execute-analysis.ts`'in şişmemesi için ayrı modül: `buildAnalysisDelta` saf/
// test edilebilir, `computeAnalysisDelta` DB'den okuyup onu çağıran ince katman.

type AnalysisDeltaSupabaseClient = SupabaseClient<Database>;

const MAX_TOP_COMPETITORS = 3;
const MAX_THEMES_PER_BUCKET = 5;

export interface AnalysisDeltaCompetitorReviewCount {
  competitor_id: string;
  name: string;
  count: number;
}

// bkz. src/lib/analysis/competitor-alerts.ts, docs/02-business-rules.md
// Bölüm G kural 4/5/6 — Overview "Bu analizde ne değişti" kartındaki
// "Uyarılar" listesi bu şekli birebir kullanır (bkz. docs/08-dashboard.md).
export interface AnalysisDeltaAlert {
  type: "competitor_review_surge" | "competitor_rating_shift" | "competitor_negative_spike";
  competitor_name: string;
  detail: Record<string, number | string>;
}

export type ZeroNewTasksReason =
  | "no_new_signal"
  | "all_themes_below_threshold"
  | "own_analysis_failed"
  | "stage2_failed";

export interface AnalysisDelta {
  version: 1;
  window_days: number;
  // Önceki succeeded/partial koşunun `finished_at`'i yerine `businesses.last_scraped_at`
  // (executeAnalysis çağrılmadan ÖNCEki değeri) kullanılır — pratikte aynı ana
  // denk gelir ve zaten cooldown/"son analiz" göstergesi için var olan tek
  // kaynaktır (bkz. computeAnalysisDelta çağrı noktası, execute-analysis.ts).
  // İlk analizde null.
  previous_run_at: string | null;
  own_new_reviews: number;
  competitor_new_reviews: number;
  competitor_new_reviews_top: AnalysisDeltaCompetitorReviewCount[];
  own_unreplied_reviews: number;
  tasks_created: number;
  tasks_updated: number;
  tasks_reopened: number;
  themes_worsening: string[];
  themes_improving: string[];
  themes_critical: string[];
  zero_new_tasks_reason: ZeroNewTasksReason | null;
  // Faz 2.7 — rakip uyarıları (competitor_review_surge/rating_shift/negative_spike).
  // Opsiyonel: bu alan eklenmeden ÖNCE yazılmış eski `analysis_runs.delta`
  // satırlarında yok (resolveAnalysisDelta bunu `as unknown as AnalysisDelta`
  // ile cast ediyor, şema validasyonu yok) — UI undefined/boş diziyi aynı
  // şekilde ("uyarı yok") ele almalı. `version` hâlâ 1 (şekle geriye dönük
  // uyumlu, opsiyonel bir alan eklemek breaking değil).
  alerts?: AnalysisDeltaAlert[];
}

export type TaskGenerationStatus = "ok" | "skipped_own_failed" | "skipped_stage2_failed";

type ThemeTrendLike = Pick<ThemeTrendInput, "theme" | "trend" | "severity">;

export interface BuildAnalysisDeltaInput {
  windowDays: number;
  previousRunAt: string | null;
  ownNewReviews: number;
  competitorNewReviewsByCompetitor: AnalysisDeltaCompetitorReviewCount[];
  ownUnrepliedReviews: number;
  tasksCreated: number;
  tasksUpdated: number;
  tasksReopened: number;
  ownThemeTrends: ThemeTrendLike[];
  taskGenerationStatus: TaskGenerationStatus;
  // Stage 2 filterCandidates çıktısının uzunluğu (own tema vardı ama eşiği
  // geçen aday yoksa 0) — SADECE zero_new_tasks_reason ayrımı için taşınır,
  // skorlama/filtreleme mantığının kendisini etkilemez.
  filteredCandidateCount: number;
}

// bkz. docs/09-task-engine.md görev oluşturma akışı — tasks_created===0 iken
// nedeni sırayla: own Aşama 1 hiç çalışmadıysa (own_analysis_failed), Aşama 2
// (gap analysis) başarısızsa (stage2_failed), own temalar vardı ama hiçbiri
// filtreyi geçemediyse (all_themes_below_threshold — bkz. docs/02-business-rules.md
// Bölüm D eşikleri), aksi halde (own tema yok ya da geçen adaylar zaten mevcut
// açık görevleri güncelledi) no_new_signal.
function resolveZeroNewTasksReason(input: BuildAnalysisDeltaInput): ZeroNewTasksReason | null {
  if (input.tasksCreated !== 0) {
    return null;
  }
  if (input.taskGenerationStatus === "skipped_own_failed") {
    return "own_analysis_failed";
  }
  if (input.taskGenerationStatus === "skipped_stage2_failed") {
    return "stage2_failed";
  }
  const ownThemesExisted = input.ownThemeTrends.length > 0;
  if (ownThemesExisted && input.filteredCandidateCount === 0) {
    return "all_themes_below_threshold";
  }
  return "no_new_signal";
}

// Saf/test edilebilir çekirdek — tüm girdiler önceden çözülmüş halde gelir,
// hiçbir DB/AI çağrısı yapmaz (bkz. src/lib/analysis/analysis-delta.test.ts).
export function buildAnalysisDelta(input: BuildAnalysisDeltaInput): AnalysisDelta {
  const competitorTop = input.competitorNewReviewsByCompetitor
    .filter((c) => c.count > 0)
    .slice()
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_TOP_COMPETITORS);

  const competitorTotal = input.competitorNewReviewsByCompetitor.reduce((sum, c) => sum + c.count, 0);

  const themesWorsening = input.ownThemeTrends
    .filter((t) => t.trend === "worsening")
    .map((t) => t.theme)
    .slice(0, MAX_THEMES_PER_BUCKET);
  const themesImproving = input.ownThemeTrends
    .filter((t) => t.trend === "improving")
    .map((t) => t.theme)
    .slice(0, MAX_THEMES_PER_BUCKET);
  const themesCritical = input.ownThemeTrends
    .filter((t) => t.severity === "critical")
    .map((t) => t.theme)
    .slice(0, MAX_THEMES_PER_BUCKET);

  return {
    version: 1,
    window_days: input.windowDays,
    previous_run_at: input.previousRunAt,
    own_new_reviews: input.ownNewReviews,
    competitor_new_reviews: competitorTotal,
    competitor_new_reviews_top: competitorTop,
    own_unreplied_reviews: input.ownUnrepliedReviews,
    tasks_created: input.tasksCreated,
    tasks_updated: input.tasksUpdated,
    tasks_reopened: input.tasksReopened,
    themes_worsening: themesWorsening,
    themes_improving: themesImproving,
    themes_critical: themesCritical,
    zero_new_tasks_reason: resolveZeroNewTasksReason(input),
  };
}

// "Yeni yorum" sayısı `scraped_at` baz alınarak hesaplanır, `published_at`
// (Google/Trustpilot'taki asıl yayın tarihi) DEĞİL. Gerekçe: reviews upsert'i
// (execute-analysis.ts mapToReviewRows → ScrapedSourceReview) `scraped_at`'i
// hiç payload'a koymuyor; bu kolonun DB default'u (`default now()`, bkz.
// 20260702090300_reviews_and_analysis.sql) sadece İLK insert'te yazılır, aynı
// (source, source_ref, review_id) tekrar Apify'dan dönüp upsert edildiğinde
// dokunulmaz. Yani `scraped_at`, "bu satırı sistemde ilk ne zaman gördük"
// sorusunu güvenilir şekilde yanıtlıyor. `published_at` ise Google'daki asıl
// tarih — bir rakip yeni eklendiğinde ya da pencere adaptif genişlediğinde
// (bkz. docs/02-business-rules.md Bölüm C) eskiden yayınlanmış ama bizim için
// YENİ olan bir yorumu "yeni değil" diye yanlış sınıflandırabilirdi.
async function countNewOwnReviews(
  supabase: AnalysisDeltaSupabaseClient,
  businessId: string,
  sinceIso: string,
): Promise<number> {
  const { count } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("owner_type", "own")
    .gt("scraped_at", sinceIso);
  return count ?? 0;
}

// export edilir: execute-analysis.ts runAnalysisPipeline aynı sonucu hem
// buradaki (computeAnalysisDelta) top-3 listesi hem de competitor-alerts.ts
// competitor_review_surge girdisi (newReviewsThisCycle, TÜM rakipler — top-3
// kesintisine tabi değil) için tek sorguda hesaplayıp iki tarafa da geçirir.
export async function countNewCompetitorReviews(
  supabase: AnalysisDeltaSupabaseClient,
  competitors: { id: string; name: string }[],
  sinceIso: string,
): Promise<AnalysisDeltaCompetitorReviewCount[]> {
  if (competitors.length === 0) {
    return [];
  }
  const { data } = await supabase
    .from("reviews")
    .select("business_id")
    .in(
      "business_id",
      competitors.map((c) => c.id),
    )
    .eq("owner_type", "competitor")
    .gt("scraped_at", sinceIso);

  const countByCompetitorId = new Map<string, number>();
  for (const row of data ?? []) {
    countByCompetitorId.set(row.business_id, (countByCompetitorId.get(row.business_id) ?? 0) + 1);
  }

  return competitors.map((c) => ({ competitor_id: c.id, name: c.name, count: countByCompetitorId.get(c.id) ?? 0 }));
}

// Ham metnin gösterilmediği bir "yanıtlanmamış yorum" sayacı (bkz.
// docs/02-business-rules.md Bölüm H) — sadece sayı, metin yok. Pencere
// (`windowStartIso`) analiz penceresiyle aynıdır, önceki koşuyla değil.
async function countOwnUnrepliedReviews(
  supabase: AnalysisDeltaSupabaseClient,
  businessId: string,
  windowStartIso: string,
): Promise<number> {
  const { count } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("owner_type", "own")
    .gte("published_at", windowStartIso)
    .is("owner_reply", null);
  return count ?? 0;
}

export interface ComputeAnalysisDeltaParams {
  businessId: string;
  competitors: { id: string; name: string }[];
  windowDays: number;
  previousRunAt: string | null;
  windowStartIso: string;
  tasksCreated: number;
  tasksUpdated: number;
  tasksReopened: number;
  ownThemeTrends: ThemeTrendLike[];
  taskGenerationStatus: TaskGenerationStatus;
  filteredCandidateCount: number;
  // Önceden hesaplanmış rakip başına yeni yorum sayısı (bkz.
  // countNewCompetitorReviews) — verilirse bu fonksiyon aynı sorguyu tekrar
  // atmaz. execute-analysis.ts hem bu delta'nın top-3 listesi hem de
  // competitor-alerts.ts'in competitor_review_surge girdisi için aynı
  // sonucu tek seferde hesaplayıp buraya iletir.
  competitorNewReviewsByCompetitor?: AnalysisDeltaCompetitorReviewCount[];
}

// İnce DB katmanı — executeAnalysis'in pipeline sonunda çağırdığı tek giriş
// noktası. `previousRunAt` yoksa (ilk analiz) "yeni" sayaçları pencere
// başlangıcına göre hesaplanır ki ilk analizde de anlamlı bir sayı gösterilsin
// (0 yerine).
export async function computeAnalysisDelta(
  supabase: AnalysisDeltaSupabaseClient,
  params: ComputeAnalysisDeltaParams,
): Promise<AnalysisDelta> {
  const sinceIso = params.previousRunAt ?? params.windowStartIso;

  const [ownNewReviews, competitorNewReviewsByCompetitor, ownUnrepliedReviews] = await Promise.all([
    countNewOwnReviews(supabase, params.businessId, sinceIso),
    params.competitorNewReviewsByCompetitor ?? countNewCompetitorReviews(supabase, params.competitors, sinceIso),
    countOwnUnrepliedReviews(supabase, params.businessId, params.windowStartIso),
  ]);

  return buildAnalysisDelta({
    windowDays: params.windowDays,
    previousRunAt: params.previousRunAt,
    ownNewReviews,
    competitorNewReviewsByCompetitor,
    ownUnrepliedReviews,
    tasksCreated: params.tasksCreated,
    tasksUpdated: params.tasksUpdated,
    tasksReopened: params.tasksReopened,
    ownThemeTrends: params.ownThemeTrends,
    taskGenerationStatus: params.taskGenerationStatus,
    filteredCandidateCount: params.filteredCandidateCount,
  });
}

// analysis_runs güncellemelerinde manuel rota ile cron döngüsünün aynı jsonb
// cast'ini paylaşması için tek noktadan üretilir (bkz. scrape-metrics.ts
// toScrapeMetricColumns ile aynı desen).
export function toAnalysisDeltaColumn(delta: AnalysisDelta): TablesUpdate<"analysis_runs"> {
  return { delta: delta as unknown as Json };
}
