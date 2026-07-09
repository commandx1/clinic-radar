import { type SupabaseClient } from "@supabase/supabase-js";

import { defaultLocale } from "@/i18n/locales";
import { acquireAnalysisRun } from "@/lib/analysis/acquire-analysis-run";
import { executeAnalysis } from "@/lib/analysis/execute-analysis";
import { toScrapeMetricColumns } from "@/lib/analysis/scrape-metrics";
import { MIN_COMPETITORS, PRO_PLAN_ANALYSIS_COOLDOWN_DAYS } from "@/lib/constants";
import type { Database } from "@/types/database.types";

type CronSupabaseClient = SupabaseClient<Database>;

// Zaman bütçesi: yeni bir işletmeye başlamadan önce en az bu kadar süre kalmış
// OLMALI. Önceki değer (= tüm pencere) kapıyı ilk işletmeden sonra hep tetikleyip
// tetikleme başına tam olarak 1 işletme işlenmesine yol açıyordu (bug). Artık
// tek işletmenin tipik Apify + Claude süresi için tutucu bir rezerv; kalan süre
// bundan azsa yeni işletmeye başlanmaz, geri kalanlar route'un self-chain
// mekanizmasıyla (bkz. api/cron/weekly-analysis/route.ts) devralınır.
const PER_BUSINESS_RESERVE_MS = 90_000;
const CRON_APIFY_TIMEOUT_MS = 280_000;
const CRON_MAX_DURATION_MS = 300_000;

interface CronCycleSummary {
  eligible: number;
  processed: number;
  succeeded: number;
  partial: number;
  failed: number;
  // Zaman bütçesi tükendiği için hiç denenmeyen işletme sayısı — route bunu
  // self-chain kararı için kullanır (remaining > 0 ise kendini yeniden tetikler).
  remaining: number;
  // Zaten 'running' koşusu olduğu için atlanan işletme sayısı (eşzamanlılık kilidi).
  skippedRunning: number;
}

// bkz. docs/02-business-rules.md Bölüm A — Pro plan haftalık analiz döngüsü.
// Manuel run route.ts ile aynı pipeline'ı (executeAnalysis) paylaşır; sadece
// uygunluk taraması ve analysis_runs kayıt/trigger farkı vardır. Dosya başına
// ~100 satır sınırı (CLAUDE.md) nedeniyle route.ts'den ayrıldı.
export async function runCronAnalysisCycle(supabase: CronSupabaseClient): Promise<CronCycleSummary> {
  const { data: proSubscriptions } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("plan", "pro")
    .eq("status", "active");

  const proUserIds = (proSubscriptions ?? []).map((s) => s.user_id);

  // Uygunluk filtreleri sorguda: enrich edilmiş (google_place_id + lat) VE
  // daha önce en az bir kez analiz edilmiş (last_scraped_at NOT NULL — ilk
  // analiz bilinçli olarak manuel bırakıldı, cron ilk analizi tetiklemez) VE
  // Pro cooldown süresi dolmuş işletmeler, en eskiden yeniye sıralı.
  const cooldownCutoffIso = new Date(
    Date.now() - PRO_PLAN_ANALYSIS_COOLDOWN_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: businessData } =
    proUserIds.length > 0
      ? await supabase
          .from("businesses")
          .select("id, google_place_id, lat, name, category, rating, user_id")
          .in("user_id", proUserIds)
          .not("google_place_id", "is", null)
          .not("lat", "is", null)
          .not("last_scraped_at", "is", null)
          .lt("last_scraped_at", cooldownCutoffIso)
          .order("last_scraped_at", { ascending: true })
      : { data: [] };

  const businesses = businessData ?? [];

  // bkz. docs/02-business-rules.md Bölüm G kural 3 — kritik sinyal e-postası
  // için işletme sahibinin e-postasına ihtiyaç var; bu döngüdeki tüm
  // işletmeler zaten Pro filtresinden geçti (yukarıdaki proUserIds sorgusu).
  const ownerEmailByUserId = new Map<string, string>();
  if (businesses.length > 0) {
    const { data: ownerUsers } = await supabase
      .from("users")
      .select("id, email")
      .in(
        "id",
        Array.from(new Set(businesses.map((b) => b.user_id))),
      );
    for (const ownerUser of ownerUsers ?? []) {
      ownerEmailByUserId.set(ownerUser.id, ownerUser.email);
    }
  }
  const eligible = businesses.length;
  let processed = 0;
  let succeeded = 0;
  let partial = 0;
  let failed = 0;
  let iterated = 0;
  let skippedRunning = 0;

  const startTime = Date.now();

  for (const business of businesses) {
    // Zaman bütçesi kapısı — en az bir işletme her zaman denenir; sonrasında
    // yalnızca bir işletmeyi bitirmeye yetecek rezerv kaldıysa devam edilir.
    // Kalanlar route'un self-chain devamına (remaining > 0) bırakılır.
    if (iterated > 0 && Date.now() - startTime > CRON_MAX_DURATION_MS - PER_BUSINESS_RESERVE_MS) {
      break;
    }
    iterated += 1;

    let runId: string | null = null;
    try {
      const { data: competitors } = await supabase
        .from("competitors")
        .select("id, google_place_id, name, rating")
        .eq("business_id", business.id);

      if (!competitors || competitors.length < MIN_COMPETITORS) {
        const { error: insertError } = await supabase.from("analysis_runs").insert({
          business_id: business.id,
          trigger: "cron",
          status: "failed",
          error: "insufficient_competitors",
          finished_at: new Date().toISOString(),
        });
        if (insertError) {
          console.error("analysis_runs kaydı oluşturulamadı:", insertError);
        }
        failed += 1;
        continue;
      }

      // bkz. acquire-analysis-run.ts — işletme başına tek 'running' koşu.
      // Kullanıcı aynı anda manuel analiz tetiklemişse cron atlar; çift
      // Apify/Claude maliyeti oluşmaz.
      const acquired = await acquireAnalysisRun(supabase, business.id, "cron");
      if (!acquired.ok) {
        skippedRunning += 1;
        continue;
      }
      runId = acquired.runId;

      const result = await executeAnalysis(
        supabase,
        {
          id: business.id,
          google_place_id: business.google_place_id,
          lat: business.lat,
          name: business.name,
          category: business.category,
          rating: business.rating,
        },
        competitors,
        defaultLocale,
        { isPro: true, ownerEmail: ownerEmailByUserId.get(business.user_id) ?? null },
        { apifyTimeoutMs: CRON_APIFY_TIMEOUT_MS },
      );

      if (!result.ok) {
        if (runId) {
          const { error: updateError } = await supabase
            .from("analysis_runs")
            .update({
              status: "failed",
              error: result.error,
              finished_at: new Date().toISOString(),
              ...toScrapeMetricColumns(result.scrape),
            })
            .eq("id", runId);
          if (updateError) {
            console.error("analysis_runs kaydı güncellenemedi:", updateError);
          }
        }
        failed += 1;
        processed += 1;
        continue;
      }

      if (runId) {
        const { error: updateError } = await supabase
          .from("analysis_runs")
          .update({
            // bkz. 20260717000000 migration — 'partial' artık gerçek durumuyla
            // kaydedilir, 'succeeded' altında gizlenmez.
            status: result.status === "partial" ? "partial" : "succeeded",
            error: null,
            finished_at: new Date().toISOString(),
            ...toScrapeMetricColumns(result.scrape),
          })
          .eq("id", runId);
        if (updateError) {
          console.error("analysis_runs kaydı güncellenemedi:", updateError);
        }
      }

      if (result.status === "partial") {
        partial += 1;
      } else {
        succeeded += 1;
      }
      processed += 1;
    } catch (err) {
      console.error("Cron analiz döngüsünde beklenmeyen hata:", err);
      if (runId) {
        const { error: updateError } = await supabase
          .from("analysis_runs")
          .update({
            status: "failed",
            error: err instanceof Error ? err.message : "bilinmeyen hata",
            finished_at: new Date().toISOString(),
          })
          .eq("id", runId);
        if (updateError) {
          console.error("analysis_runs kaydı güncellenemedi:", updateError);
        }
      }
      failed += 1;
      processed += 1;
    }
  }

  const remaining = eligible - iterated;

  return { eligible, processed, succeeded, partial, failed, remaining, skippedRunning };
}
