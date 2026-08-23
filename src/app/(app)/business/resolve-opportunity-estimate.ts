import { OPPORTUNITY_VELOCITY_WINDOW_DAYS } from "@/lib/constants";
import type { createClient } from "@/lib/supabase/server";
import { estimateOpportunity, type OpportunityEstimate } from "@/lib/task-engine/opportunity-estimate";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface ResolvedOpportunityEstimate {
  estimate: OpportunityEstimate;
  // Kart, gap badge'inin yanında ham own puanını da göstermek istiyor;
  // OpportunityEstimate kasıtlı olarak bunu taşımaz (saf modül yalnızca
  // türetilmiş sonuçları döner) — bkz. opportunity-estimate.ts.
  ownRating: number | null;
}

// Rakip yorum sayımı: reviews.business_id, owner_type='competitor' satırlarda
// competitors.id'ye eşittir (bkz. docs/03-database.md). Tek sorguda tüm
// rakiplerin son OPPORTUNITY_VELOCITY_WINDOW_DAYS gün içindeki yorumlarını
// çekip business_id'ye göre JS tarafında sayıyoruz — group by aggregate
// Supabase client'ında yok, satisfaction-overview.ts'teki desenle aynı.
async function resolveCompetitorReviewCounts(
  supabase: SupabaseClient,
  competitorIds: string[],
  windowStart: string,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (competitorIds.length === 0) {
    return counts;
  }

  const { data } = await supabase
    .from("reviews")
    .select("business_id")
    .eq("owner_type", "competitor")
    .in("business_id", competitorIds)
    .gte("published_at", windowStart);

  for (const row of data ?? []) {
    if (!row.business_id) {
      continue;
    }
    counts.set(row.business_id, (counts.get(row.business_id) ?? 0) + 1);
  }
  return counts;
}

export async function resolveOpportunityEstimate(
  supabase: SupabaseClient,
  businessId: string,
): Promise<ResolvedOpportunityEstimate> {
  const windowStart = new Date(
    Date.now() - OPPORTUNITY_VELOCITY_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [{ data: business }, { data: competitors }, { count: ownReviewCount }] = await Promise.all([
    supabase
      .from("businesses")
      .select("rating, avg_patient_value_usd, monthly_new_patients")
      .eq("id", businessId)
      .single(),
    supabase.from("competitors").select("id, rating").eq("business_id", businessId),
    supabase
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("owner_type", "own")
      .eq("business_id", businessId)
      .gte("published_at", windowStart),
  ]);

  const competitorRows = competitors ?? [];
  const competitorIds = competitorRows.map((c) => c.id);
  const competitorReviewCounts = await resolveCompetitorReviewCounts(supabase, competitorIds, windowStart);

  const estimate = estimateOpportunity({
    ownRating: business?.rating ?? null,
    competitorRatings: competitorRows.map((c) => c.rating),
    ownReviewsInWindow: ownReviewCount ?? 0,
    competitorReviewsInWindow: competitorIds.map((id) => competitorReviewCounts.get(id) ?? 0),
    windowDays: OPPORTUNITY_VELOCITY_WINDOW_DAYS,
    avgPatientValueUsd: business?.avg_patient_value_usd ?? null,
    monthlyNewPatients: business?.monthly_new_patients ?? null,
  });

  return { estimate, ownRating: business?.rating ?? null };
}
