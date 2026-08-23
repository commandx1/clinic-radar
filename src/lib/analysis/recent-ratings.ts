import type { SupabaseClient } from "@supabase/supabase-js";

import { RECENT_RATING_MIN_REVIEWS } from "@/lib/constants";
import { calculateCompetitorRank } from "@/lib/task-engine/clinic-score";
import type { Database } from "@/types/database.types";

// bkz. supabase/migrations/20260823000500_recent_ratings_and_competitor_alerts.sql,
// docs/02-business-rules.md Bölüm F, docs/08-dashboard.md Trend/Competitors.
//
// PROBLEM: businesses.rating / competitors.rating yalnızca ilk Apify
// enrichment'ında (Google Places "place details") yazılır — sonraki analiz
// döngüleri Google yorum actor'ünden yorum başına puan alır ama bu toplu
// puanı hiç güncellemez. Bu modül, analiz penceresi içindeki taze
// yorumların puanlarından "canlı" bir ortalama (recent_rating) hesaplayıp
// businesses/competitors'a ayrı kolonlarda yazar — resmi `rating` DOKUNULMAZ.

type AnalysisSupabaseClient = SupabaseClient<Database>;

export interface RecentRating {
  rating: number | null;
  reviews: number;
}

// Saf/test edilebilir çekirdek (bkz. recent-ratings.test.ts). Gürültüyü
// elemek için RECENT_RATING_MIN_REVIEWS altındaki yorum sayısında rating
// null döner (ör. tek bir 1 yıldızlı yorum "canlı puan"ı yanlış temsil
// etmesin) — `reviews` sayısı yine de gerçek değeriyle döner.
export function computeRecentRating(stars: number[]): RecentRating {
  if (stars.length < RECENT_RATING_MIN_REVIEWS) {
    return { rating: null, reviews: stars.length };
  }
  const sum = stars.reduce((acc, star) => acc + star, 0);
  return { rating: Math.round((sum / stars.length) * 100) / 100, reviews: stars.length };
}

// Own'un `rating`i (0 varsayımı) mevcut resmi Competitor Rank ile aynı
// davranışı taşır (bkz. calculateCompetitorRank) ama hiçbir taraf henüz
// RECENT_RATING_MIN_REVIEWS'e ulaşmadıysa (own VE tüm rakipler null) sıra
// anlamsızdır — bu durumda null döner, UI göstermez.
export function computeRecentRank(ownRating: number | null, competitorRatings: (number | null)[]): number | null {
  const hasAnySignal = ownRating !== null || competitorRatings.some((r) => r !== null);
  if (!hasAnySignal) {
    return null;
  }
  return calculateCompetitorRank(ownRating, competitorRatings).rank;
}

interface RatingOwnerRef {
  id: string;
}

// Pencere içindeki own + rakip yorumlarının `rating`lerini tek sorguda
// toplar (business_id, id uzayları ayrık olduğu için owner_type'a göre ayrı
// filtrelemeye gerek yok). `rating` null olan satırlar (Apify bazen
// döndürmez) elenir.
async function fetchStarsByOwnerId(
  supabase: AnalysisSupabaseClient,
  ownerIds: string[],
  windowStartIso: string,
): Promise<Map<string, number[]>> {
  const byOwnerId = new Map<string, number[]>();
  if (ownerIds.length === 0) {
    return byOwnerId;
  }

  const { data } = await supabase
    .from("reviews")
    .select("business_id, rating")
    .in("business_id", ownerIds)
    .gte("published_at", windowStartIso)
    .not("rating", "is", null);

  for (const row of data ?? []) {
    // `.not("rating", "is", null)` filtresi PostgREST-js tipinde `rating`i
    // zaten `number`e daraltıyor (null elenmiş) — ekstra runtime kontrolü
    // gerekmiyor.
    const list = byOwnerId.get(row.business_id) ?? [];
    list.push(row.rating);
    byOwnerId.set(row.business_id, list);
  }
  return byOwnerId;
}

export interface RecentRatingWithPrevious {
  // Bu döngünün UPDATE'inden ÖNCEki değer — null bir önceki döngüde hiç
  // yazılmamış (migration öncesi/ilk analiz) anlamına gelir, "0" DEĞİLDİR.
  previous: RecentRating | null;
  current: RecentRating;
}

export interface CompetitorRecentRating extends RecentRatingWithPrevious {
  id: string;
  name: string;
}

export interface RecentRatingsSnapshot {
  own: RecentRating | null;
  competitors: { competitor_id: string; name: string; rating: number | null; reviews: number }[];
  recent_rank: number | null;
}

export interface RecentRatingsResult {
  own: RecentRatingWithPrevious;
  competitors: CompetitorRecentRating[];
  // clinic_score_history.recent_ratings jsonb kolonuna doğrudan yazılacak
  // şekil — bkz. docs/03-database.md.
  snapshot: RecentRatingsSnapshot;
}

interface PreviousRatingColumns {
  recent_rating: number | null;
  recent_rating_reviews: number | null;
}

function toRecentRatingOrNull(row: PreviousRatingColumns | null | undefined): RecentRating | null {
  if (row?.recent_rating === null || row?.recent_rating === undefined) {
    return null;
  }
  return { rating: row.recent_rating, reviews: row.recent_rating_reviews ?? 0 };
}

// Aşama: her analiz döngüsünde çağrılır (execute-analysis.ts
// runAnalysisPipeline). Önce ÖNCEKİ değerler okunur (rakip uyarıları
// competitor_rating_shift bir önceki döngüyle kıyaslamak için ihtiyaç
// duyar — bkz. competitor-alerts.ts), SONRA yeni değerler hesaplanıp
// businesses/competitors'a yazılır. Resmi Competitor Rank (rating kolonu)
// bu fonksiyonun hiçbir yerinde değiştirilmez — bilinçli olarak ayrı
// kalır (bkz. docs/02-business-rules.md Bölüm F).
export async function computeAndPersistRecentRatings(
  supabase: AnalysisSupabaseClient,
  business: { id: string },
  competitors: { id: string; name: string }[],
  windowStartIso: string,
  windowDays: number,
): Promise<RecentRatingsResult> {
  const [{ data: prevBusiness }, prevCompetitorsResult] = await Promise.all([
    supabase.from("businesses").select("recent_rating, recent_rating_reviews").eq("id", business.id).maybeSingle(),
    competitors.length > 0
      ? supabase
          .from("competitors")
          .select("id, recent_rating, recent_rating_reviews")
          .in(
            "id",
            competitors.map((c) => c.id),
          )
      : Promise.resolve({ data: [] as { id: string; recent_rating: number | null; recent_rating_reviews: number | null }[] }),
  ]);
  const prevByCompetitorId = new Map((prevCompetitorsResult.data ?? []).map((c) => [c.id, c]));

  const ownerIds: RatingOwnerRef[] = [{ id: business.id }, ...competitors.map((c) => ({ id: c.id }))];
  const starsByOwnerId = await fetchStarsByOwnerId(
    supabase,
    ownerIds.map((o) => o.id),
    windowStartIso,
  );

  const ownCurrent = computeRecentRating(starsByOwnerId.get(business.id) ?? []);
  const competitorResults: CompetitorRecentRating[] = competitors.map((c) => ({
    id: c.id,
    name: c.name,
    current: computeRecentRating(starsByOwnerId.get(c.id) ?? []),
    previous: toRecentRatingOrNull(prevByCompetitorId.get(c.id)),
  }));

  const nowIso = new Date().toISOString();
  const { error: businessUpdateError } = await supabase
    .from("businesses")
    .update({
      recent_rating: ownCurrent.rating,
      recent_rating_reviews: ownCurrent.reviews,
      recent_rating_window_days: windowDays,
      recent_rating_updated_at: nowIso,
    })
    .eq("id", business.id);
  if (businessUpdateError) {
    console.error("recent_rating (own) güncellenemedi:", businessUpdateError);
  }

  for (const competitor of competitorResults) {
    const { error } = await supabase
      .from("competitors")
      .update({
        recent_rating: competitor.current.rating,
        recent_rating_reviews: competitor.current.reviews,
        recent_rating_window_days: windowDays,
        recent_rating_updated_at: nowIso,
      })
      .eq("id", competitor.id);
    if (error) {
      console.error("recent_rating (rakip) güncellenemedi:", competitor.id, error);
    }
  }

  const recentRank = computeRecentRank(
    ownCurrent.rating,
    competitorResults.map((c) => c.current.rating),
  );

  return {
    own: { previous: toRecentRatingOrNull(prevBusiness), current: ownCurrent },
    competitors: competitorResults,
    snapshot: {
      own: ownCurrent,
      competitors: competitorResults.map((c) => ({
        competitor_id: c.id,
        name: c.name,
        rating: c.current.rating,
        reviews: c.current.reviews,
      })),
      recent_rank: recentRank,
    },
  };
}

// Saf/test edilebilir — bkz. recent-ratings.test.ts. Tek nokta bile
// yoksa (rakip yok ya da hiçbiri eşiği geçmediyse) null döner; çağıran
// taraf (TrendChart) null noktaları `connectNulls` ile atlar.
export function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 100) / 100;
  }
  return sorted[mid];
}

export interface RecentRatingTrendPoint {
  ownRecentRating: number | null;
  competitorMedianRecentRating: number | null;
}

// Trend sayfasının `clinic_score_history.recent_ratings` jsonb'sinden tek bir
// grafik noktası türetmesi için — bkz. docs/08-dashboard.md Trend, TrendChart.
// Own = snapshot anındaki own recent_rating (null olabilir); rakip serisi
// TEK bir rakip değil, o anki tüm rakiplerin recent_rating MEDYANIdır (bkz.
// docs/02-business-rules.md Bölüm F).
export function extractRecentRatingTrendPoint(snapshot: RecentRatingsSnapshot | null): RecentRatingTrendPoint {
  if (!snapshot) {
    return { ownRecentRating: null, competitorMedianRecentRating: null };
  }
  const competitorRatings = snapshot.competitors
    .map((c) => c.rating)
    .filter((rating): rating is number => rating !== null);

  return {
    ownRecentRating: snapshot.own?.rating ?? null,
    competitorMedianRecentRating: median(competitorRatings),
  };
}
