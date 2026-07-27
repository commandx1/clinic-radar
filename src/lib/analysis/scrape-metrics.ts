import { REVIEW_SOURCE_ADAPTERS } from "@/lib/reviews/registry";
import type { ReviewSource } from "@/lib/reviews/types";
import type { TablesUpdate } from "@/types/database.types";

// bkz. docs/11-risks-assumptions.md Risk 3 — scrape başarı/maliyet/latency
// ilk günden loglanır. Bu modül yalnızca ölçüm taşır; analiz davranışını
// değiştirmez ve hiçbir zaman akışı düşürmez.

export interface ScrapeMetrics {
  success: boolean;
  fetchedReviews: number | null; // başarısız job'da null — 0 ("job çalıştı, sonuç yok") ile karışmasın
  latencyMs: number;
  costUsd: number | null;
}

// Her kaynağın maliyeti kendi adaptöründen gelir (bkz.
// src/lib/reviews/registry.ts, src/lib/reviews/sources/google.ts) — ör.
// compass/google-maps-reviews-scraper pay-per-result fiyatlandırmalıdır ve
// kullandığımız run-sync-get-dataset-items yanıtı gerçek usage bilgisi
// taşımaz (bkz. src/lib/apify/client.ts). Maliyet bu yüzden her kaynak için
// "sonuç sayısı × birim fiyat" olarak tahmin edilip toplanır; bir kaynağın
// adaptörü null dönerse (env tanımsız/geçersiz) o kaynak maliyete katkı
// yapmaz — sadece TÜM kaynaklar null dönerse toplam sonuç null olur (bugünkü
// tek-kaynaklı davranışla birebir aynı semantik).
export function estimateScrapeCostUsd(countsBySource: Map<ReviewSource, number>): number | null {
  let total = 0;
  let anyPriced = false;

  for (const [source, count] of countsBySource) {
    if (count <= 0) {
      continue;
    }
    const adapter = REVIEW_SOURCE_ADAPTERS[source];
    const unitPrice = adapter?.costPerReviewUsd() ?? null;
    if (unitPrice === null) {
      continue;
    }
    anyPriced = true;
    total += count * unitPrice;
  }

  if (!anyPriced) {
    return null;
  }
  // numeric(10,4) kolonuna uygun yuvarlama.
  return Math.round(total * 10_000) / 10_000;
}

// analysis_runs güncellemelerinde manuel rota ile cron döngüsünün aynı kolon
// eşlemesini paylaşması için tek noktadan üretilir.
export function toScrapeMetricColumns(scrape: ScrapeMetrics): TablesUpdate<"analysis_runs"> {
  return {
    scrape_success: scrape.success,
    fetched_reviews: scrape.fetchedReviews,
    scrape_latency_ms: scrape.latencyMs,
    scrape_cost_usd: scrape.costUsd,
  };
}
