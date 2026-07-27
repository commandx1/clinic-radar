import { fetchReviewsForPlaces } from "@/lib/apify/google-reviews";
import type { ReviewSourceAdapter } from "@/lib/reviews/registry";
import { parseUnitPriceEnv } from "@/lib/reviews/sources/price";
import type { ScrapedSourceReview } from "@/lib/reviews/types";

// Google adaptörü — bkz. docs/02-business-rules.md Bölüm I. Google
// zorunlu birincil kaynaktır ve `source_ref`'i businesses/competitors
// tablosundaki `google_place_id`'den gelir.
// src/lib/apify/google-reviews.ts zaten ScrapedSourceReview şeklinde
// (source: "google" dahil) döner — bu dosya sadece isimlendirmeyi
// kaynak-agnostik registry ile hizalar.
export async function fetchGoogleReviews(
  sourceRefs: string[],
  maxReviewsPerSourceRef: number,
  options: { timeoutMs?: number } = {},
): Promise<ScrapedSourceReview[]> {
  return fetchReviewsForPlaces(sourceRefs, maxReviewsPerSourceRef, options);
}

// compass/google-maps-reviews-scraper pay-per-result fiyatlandırmalıdır ve
// kullandığımız run-sync-get-dataset-items yanıtı gerçek usage bilgisi
// taşımaz (bkz. src/lib/apify/client.ts). Maliyet bu yüzden
// "sonuç sayısı × birim fiyat" olarak tahmin edilir; env tanımsız/geçersizse
// null döner ve loglama sessizce maliyetsiz devam eder. (Bu mantık daha önce
// src/lib/analysis/scrape-metrics.ts içindeydi — semantik birebir korunmuştur.)
function costPerReviewUsd(): number | null {
  return parseUnitPriceEnv(process.env.APIFY_PRICE_PER_REVIEW_USD);
}

export const googleAdapter: ReviewSourceAdapter = {
  source: "google",
  costPerReviewUsd,
  fetchReviews: fetchGoogleReviews,
};
