import { runActorSync } from "@/lib/apify/client";
import type { ScrapedSourceReview } from "@/lib/reviews/types";

// Apify'a özgü alan adları burada izole edilir — actor'ün ham şeması
// değişirse sadece bu dosya güncellenir (bkz. docs/04-api.md, Apify Google
// Maps Reviews Scraper: compass/google-maps-reviews-scraper).
const GOOGLE_REVIEWS_ACTOR_ID = "compass/google-maps-reviews-scraper";

interface ApifyReviewItem {
  reviewId: string;
  placeId: string;
  name: string | null;
  stars: number | null;
  text: string | null;
  originalLanguage: string | null;
  responseFromOwnerText: string | null;
  reviewImageUrls: string[] | null;
  likesCount: number | null;
  isLocalGuide: boolean | null;
  reviewUrl: string | null;
  publishedAtDate: string | null;
}

function toScrapedReview(item: ApifyReviewItem): ScrapedSourceReview {
  return {
    review_id: item.reviewId,
    source: "google",
    source_ref: item.placeId,
    author_name: item.name,
    rating: item.stars,
    text: item.text,
    original_language: item.originalLanguage,
    translated_text: null,
    owner_reply: item.responseFromOwnerText,
    images_count: item.reviewImageUrls ? item.reviewImageUrls.length : null,
    likes: item.likesCount,
    is_local_guide: item.isLocalGuide,
    review_url: item.reviewUrl,
    published_at: item.publishedAtDate,
  };
}

export async function fetchReviewsForPlaces(
  placeIds: string[],
  maxReviewsPerPlace: number,
  { timeoutMs }: { timeoutMs?: number } = {},
): Promise<ScrapedSourceReview[]> {
  const items = await runActorSync<ApifyReviewItem>(
    GOOGLE_REVIEWS_ACTOR_ID,
    {
      placeIds,
      maxReviews: maxReviewsPerPlace,
      reviewsSort: "newest",
    },
    { timeoutMs },
  );

  return items.filter((item) => Boolean(item.reviewId) && Boolean(item.placeId)).map(toScrapedReview);
}
