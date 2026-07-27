import { googleAdapter } from "@/lib/reviews/sources/google";
import { trustpilotAdapter } from "@/lib/reviews/sources/trustpilot";
import type { ReviewSource, ScrapedSourceReview } from "@/lib/reviews/types";

// Kaynak-agnostik adaptör sözleşmesi — bkz. docs/02-business-rules.md
// Bölüm I. Yeni bir kaynak eklemek: (1) migration ile check constraint'lere
// değeri ekle, (2) src/lib/reviews/sources/<kaynak>.ts adaptörünü yaz ve
// `ReviewSourceAdapter`'ı implemente et, (3) burada REVIEW_SOURCE_ADAPTERS'a
// tek satır ekle. Pipeline'ın geri kalanı (fetch-all.ts, execute-analysis.ts)
// bu registry üzerinden çalışır — başka hiçbir yer değişmez.
export interface ReviewSourceAdapter {
  source: ReviewSource;
  // Bir yorumun tahmini maliyeti (USD); env tanımsız/geçersizse null —
  // bkz. src/lib/analysis/scrape-metrics.ts.
  costPerReviewUsd(): number | null;
  fetchReviews(
    refs: string[],
    maxPerRef: number,
    opts: { timeoutMs?: number },
  ): Promise<ScrapedSourceReview[]>;
}

// google zorunlu/birincil, trustpilot ikincil/opsiyonel kaynaktır. Kayıtlı
// olmayan bir kaynak (facebook henüz yok) fetch-all.ts tarafından sessizce
// atlanır (bkz. fetch-all.ts).
export const REVIEW_SOURCE_ADAPTERS: Partial<Record<ReviewSource, ReviewSourceAdapter>> = {
  google: googleAdapter,
  trustpilot: trustpilotAdapter,
};
