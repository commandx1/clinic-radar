import { REVIEW_SOURCE_ADAPTERS } from "@/lib/reviews/registry";
import type { ReviewSource, ScrapedSourceReview } from "@/lib/reviews/types";

// Kaynak-agnostik fetch orkestrasyonu — bkz. docs/02-business-rules.md
// Bölüm I. Yeni bir kaynak eklemek: (1) migration ile check constraint'lere
// değeri ekle, (2) src/lib/reviews/sources/<kaynak>.ts adaptörünü yaz ve
// src/lib/reviews/registry.ts'e kaydet, (3) başka hiçbir şey değişmez — bu
// fonksiyon registry'deki her kayıtlı adaptörü otomatik çağırır.
//
// Hata izolasyonu: google adaptörü hata fırlatırsa yeniden fırlatılır (bugünkü
// apify_call_failed davranışı korunur — google birincil/zorunlu kaynaktır).
// google dışı bir adaptör hata fırlatırsa loglanır ve diğer kaynaklarla devam
// edilir — ikincil bir kaynağın kesintisi tüm analizi durdurmamalı.
export async function fetchReviewsFromAllSources(
  refsBySource: Map<ReviewSource, string[]>,
  maxReviewsPerSourceRef: number,
  options: { timeoutMs?: number } = {},
): Promise<ScrapedSourceReview[]> {
  const results: ScrapedSourceReview[] = [];

  for (const [source, refs] of refsBySource) {
    if (refs.length === 0) {
      continue;
    }
    const adapter = REVIEW_SOURCE_ADAPTERS[source];
    if (!adapter) {
      continue;
    }

    if (source === "google") {
      const scraped = await adapter.fetchReviews(refs, maxReviewsPerSourceRef, options);
      results.push(...scraped);
      continue;
    }

    try {
      const scraped = await adapter.fetchReviews(refs, maxReviewsPerSourceRef, options);
      results.push(...scraped);
    } catch (error) {
      console.error(`Yorum çekme başarısız (kaynak: ${source}):`, error);
    }
  }

  return results;
}
