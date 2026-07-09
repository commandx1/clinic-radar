import { MessageSquareIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

import { SatisfactionCard } from "../satisfaction-card";
import { loadSatisfactionOverview } from "../satisfaction-overview";
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
    .select("id, rating, published_at, owner_reply, review_url")
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
            <Card key={review.id}>
              <CardContent className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{review.rating ?? "-"} ★</span>
                  {review.published_at && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(review.published_at).toLocaleDateString(locale)}
                    </span>
                  )}
                  <Badge variant={review.owner_reply ? "default" : "secondary"}>
                    {review.owner_reply ? t("repliedBadge") : t("notRepliedBadge")}
                  </Badge>
                </div>
                {review.review_url && (
                  <a
                    href={review.review_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary underline-offset-4 hover:underline"
                  >
                    {t("viewOnGoogle")}
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
