import { runActorSync } from "@/lib/apify/client";

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

// `reviews` DB satırıyla birebir eşleşir (snake_case) — id/scraped_at/
// business_id/owner_type çağıran tarafından (place_id -> owner eşlemesiyle)
// çözülür, bu dosya sadece Apify'ın ham şeklini normalize eder.
export interface ScrapedReview {
  review_id: string;
  place_id: string;
  author_name: string | null;
  rating: number | null;
  text: string | null;
  original_language: string | null;
  translated_text: null;
  owner_reply: string | null;
  images_count: number | null;
  likes: number | null;
  is_local_guide: boolean | null;
  review_url: string | null;
  published_at: string | null;
}

function toScrapedReview(item: ApifyReviewItem): ScrapedReview {
  return {
    review_id: item.reviewId,
    place_id: item.placeId,
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
): Promise<ScrapedReview[]> {
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
