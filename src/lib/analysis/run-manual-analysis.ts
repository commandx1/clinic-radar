import { type SupabaseClient } from "@supabase/supabase-js";

import { executeAnalysis } from "@/lib/analysis/execute-analysis";
import { toScrapeMetricColumns } from "@/lib/analysis/scrape-metrics";
import { MIN_COMPETITORS } from "@/lib/constants";
import { getNextAnalysisAvailableAt } from "@/lib/task-engine/analysis-cooldown";
import type { Database } from "@/types/database.types";

type ManualSupabaseClient = SupabaseClient<Database>;

interface ManualAnalysisResult {
  status: number;
  body: Record<string, unknown>;
}

// bkz. docs/04-api.md — kullanıcı tetikli manuel analiz akışı. Route sadece
// auth + provider guard'ını yapar, iş kuralları (cooldown, uygunluk, run
// kaydı, executeAnalysis çağrısı) burada toplanır — dosya başına ~100 satır
// sınırı (CLAUDE.md) nedeniyle route.ts'den ayrıldı.
export async function runManualAnalysisForBusiness(
  supabase: ManualSupabaseClient,
  businessId: string,
  userId: string,
  outputLanguage: string,
): Promise<ManualAnalysisResult> {
  const { data: business } = await supabase
    .from("businesses")
    .select("id, google_place_id, lat, name, category, rating, last_scraped_at")
    .eq("id", businessId)
    .maybeSingle();

  if (!business) {
    return { status: 404, body: { error: "not_found" } };
  }

  if (business.lat === null || business.google_place_id === null) {
    return { status: 422, body: { error: "business_not_enriched" } };
  }

  const [{ data: subscription }, { data: ownerUser }] = await Promise.all([
    supabase.from("subscriptions").select("plan").eq("user_id", userId).maybeSingle(),
    supabase.from("users").select("email").eq("id", userId).maybeSingle(),
  ]);

  if (business.last_scraped_at) {
    const nextAvailableAt = getNextAnalysisAvailableAt(business.last_scraped_at, subscription?.plan);

    if (nextAvailableAt && nextAvailableAt.getTime() > Date.now()) {
      return {
        status: 422,
        body: { error: "analysis_cooldown_active", nextAvailableAt: nextAvailableAt.toISOString() },
      };
    }
  }

  // bkz. docs/02-business-rules.md Bölüm G kural 3 — kritik sinyal e-postası
  // yalnızca Pro/Agency planlarda gönderilir.
  const notifyContext = {
    isPro: subscription?.plan === "pro" || subscription?.plan === "agency",
    ownerEmail: ownerUser?.email ?? null,
  };

  const { data: competitors } = await supabase
    .from("competitors")
    .select("id, google_place_id, name, rating")
    .eq("business_id", business.id);

  if (!competitors || competitors.length < MIN_COMPETITORS) {
    return { status: 422, body: { error: "insufficient_competitors" } };
  }

  const { data: analysisRun } = await supabase
    .from("analysis_runs")
    .insert({ business_id: business.id, trigger: "manual", status: "running" })
    .select("id")
    .single();

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
    outputLanguage,
    notifyContext,
  );

  if (!result.ok) {
    if (analysisRun) {
      await supabase
        .from("analysis_runs")
        .update({
          status: "failed",
          error: result.error,
          finished_at: new Date().toISOString(),
          ...toScrapeMetricColumns(result.scrape),
        })
        .eq("id", analysisRun.id);
    }

    const statusCode = result.error === "review_save_failed" ? 500 : 502;
    return { status: statusCode, body: { error: result.error } };
  }

  if (analysisRun) {
    await supabase
      .from("analysis_runs")
      .update({
        status: "succeeded",
        finished_at: new Date().toISOString(),
        ...toScrapeMetricColumns(result.scrape),
      })
      .eq("id", analysisRun.id);
  }

  return {
    status: 200,
    body: {
      fetched: result.fetched,
      stored: result.stored,
      ownReviews: result.ownReviews,
      competitorReviews: result.competitorReviews,
      themeAnalysis: result.themeAnalysis,
      taskGeneration: result.taskGeneration,
    },
  };
}
