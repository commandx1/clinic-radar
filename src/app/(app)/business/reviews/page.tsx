import { MessageSquareIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/empty-state";
import { createClient } from "@/lib/supabase/server";

import { SatisfactionCard } from "../satisfaction-card";
import { loadSatisfactionOverview } from "../satisfaction-overview";
import { ReviewCard } from "./review-card";
import {
  ReviewsFilterBar,
  type RatingFilter,
  type RepliedFilter,
  type ReviewFilters,
  type SortOrder,
} from "./reviews-filter-bar";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

interface ReviewRow {
  id: string;
  source: string;
  rating: number | null;
  published_at: string | null;
  owner_reply: string | null;
  review_url: string | null;
}

async function loadReviews(
  supabase: SupabaseClient,
  businessId: string,
  filters: ReviewFilters,
): Promise<ReviewRow[]> {
  let query = supabase
    .from("reviews")
    .select("id, source, rating, published_at, owner_reply, review_url")
    .eq("business_id", businessId)
    .eq("owner_type", "own");

  if (filters.rating !== "all") {
    query = query.eq("rating", Number(filters.rating));
  }
  if (filters.replied === "yes") {
    query = query.not("owner_reply", "is", null);
  } else if (filters.replied === "no") {
    query = query.is("owner_reply", null);
  }

  query = query.order("published_at", { ascending: filters.sort === "oldest" });

  const { data } = await query;
  return data ?? [];
}

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ rating?: string; replied?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const filters: ReviewFilters = {
    rating: (params.rating ?? "all") as RatingFilter,
    replied: (params.replied ?? "all") as RepliedFilter,
    sort: (params.sort ?? "newest") as SortOrder,
  };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // user hazır olduktan sonra bu dört iş bağımsız — paralel çalıştır.
  const [{ data: business }, t, tSatisfaction, locale] = await Promise.all([
    supabase.from("businesses").select("id").eq("user_id", user!.id).maybeSingle(),
    getTranslations("business.reviews"),
    getTranslations("business.satisfaction"),
    getLocale(),
  ]);

  // İkisi de business.id'ye bağlı ama birbirinden bağımsız — paralel çalıştır.
  const [reviews, satisfaction] = await Promise.all([
    loadReviews(supabase, business!.id, filters),
    loadSatisfactionOverview(supabase, business!.id),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <SatisfactionCard t={tSatisfaction} overview={satisfaction} />
      <ReviewsFilterBar filters={filters} />

      {reviews.length === 0 ? (
        <EmptyState icon={MessageSquareIcon} message={t("empty")} />
      ) : (
        <div className="flex flex-col gap-2">
          {reviews.map((review) => (
            <ReviewCard key={review.id} t={t} locale={locale} review={review} />
          ))}
        </div>
      )}
    </div>
  );
}
