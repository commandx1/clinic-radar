import type { SupabaseClient } from "@supabase/supabase-js";

import type { ProfileGapStats } from "@/lib/analysis/profile-gap-candidates";
import type { Database } from "@/types/database.types";

type AnalysisSupabaseClient = SupabaseClient<Database>;

interface ReviewReplyCounts {
  total: number;
  replied: number;
}

// bkz. docs/02-business-rules.md Bölüm D üçüncü kaynak — pencere içindeki
// toplam + yanıtlanmış yorum sayısı, hem own hem her rakip için aynı
// sorguyla sayılır. `reviews.business_id`, owner_type'a göre businesses.id ya
// da competitors.id'yi tutar (bkz. docs/03-database.md).
async function countReviewsAndReplies(
  supabase: AnalysisSupabaseClient,
  ownerId: string,
  ownerType: "own" | "competitor",
  windowStartIso: string,
): Promise<ReviewReplyCounts> {
  const { count: total } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("business_id", ownerId)
    .eq("owner_type", ownerType)
    .gte("published_at", windowStartIso);

  const { count: replied } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("business_id", ownerId)
    .eq("owner_type", ownerType)
    .gte("published_at", windowStartIso)
    .not("owner_reply", "is", null);

  return { total: total ?? 0, replied: replied ?? 0 };
}

// `website` execute-analysis.ts pipeline'ında zaten business/competitor
// satırlarından okunmuş olarak elde bulunuyor — burada tekrar sorgulanmaz,
// çağıran taraftan parametre olarak geçirilir (bkz. runAnalysisPipeline).
export async function loadProfileGapStats(
  supabase: AnalysisSupabaseClient,
  business: { id: string; website: string | null },
  competitors: { id: string; name: string; website: string | null }[],
  windowStartIso: string,
  windowDays: number,
): Promise<ProfileGapStats> {
  const ownCounts = await countReviewsAndReplies(supabase, business.id, "own", windowStartIso);

  const competitorStats = await Promise.all(
    competitors.map(async (competitor) => {
      const counts = await countReviewsAndReplies(supabase, competitor.id, "competitor", windowStartIso);
      return {
        id: competitor.id,
        name: competitor.name,
        total: counts.total,
        replied: counts.replied,
        website: competitor.website,
      };
    }),
  );

  return {
    own: { total: ownCounts.total, replied: ownCounts.replied, website: business.website },
    competitors: competitorStats,
    windowDays,
  };
}
