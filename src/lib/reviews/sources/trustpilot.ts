import { fetchTrustpilotReviews as fetchTrustpilotReviewsForDomains } from "@/lib/apify/trustpilot-reviews";
import type { ReviewSourceAdapter } from "@/lib/reviews/registry";
import { parseUnitPriceEnv } from "@/lib/reviews/sources/price";
import type { ScrapedSourceReview } from "@/lib/reviews/types";

// Trustpilot adaptörü — bkz. docs/02-business-rules.md Bölüm I. İkincil
// (opsiyonel) kaynaktır ve `source_ref`'i businesses/competitors
// tablosundaki `trustpilot_domain`'den gelir (bkz. migration
// 20260727000001_trustpilot_source.sql). src/lib/apify/trustpilot-reviews.ts
// zaten ScrapedSourceReview şeklinde (source: "trustpilot" dahil) döner —
// bu dosya sadece isimlendirmeyi kaynak-agnostik registry ile hizalar.
export async function fetchTrustpilotReviews(
  sourceRefs: string[],
  maxReviewsPerSourceRef: number,
  options: { timeoutMs?: number } = {},
): Promise<ScrapedSourceReview[]> {
  return fetchTrustpilotReviewsForDomains(sourceRefs, maxReviewsPerSourceRef, options);
}

// sian.agency/trustpilot-reviews-scraper de pay-per-result fiyatlandırmalıdır
// ve run-sync-get-dataset-items yanıtı gerçek usage bilgisi taşımaz (bkz.
// src/lib/apify/client.ts). Google'dan ayrı bir env ile fiyatlandırılır çünkü
// actor'ler farklı (ve muhtemelen farklı birim fiyata sahip).
function costPerReviewUsd(): number | null {
  return parseUnitPriceEnv(process.env.APIFY_PRICE_PER_TRUSTPILOT_REVIEW_USD);
}

export const trustpilotAdapter: ReviewSourceAdapter = {
  source: "trustpilot",
  costPerReviewUsd,
  fetchReviews: fetchTrustpilotReviews,
};
