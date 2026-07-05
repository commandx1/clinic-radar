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

// compass/google-maps-reviews-scraper pay-per-result fiyatlandırmalıdır ve
// kullandığımız run-sync-get-dataset-items yanıtı gerçek usage bilgisi
// taşımaz (bkz. src/lib/apify/client.ts). Maliyet bu yüzden
// "sonuç sayısı × birim fiyat" olarak tahmin edilir; env tanımsız/geçersizse
// null döner ve loglama sessizce maliyetsiz devam eder.
export function estimateScrapeCostUsd(fetchedReviews: number): number | null {
  const raw = process.env.APIFY_PRICE_PER_REVIEW_USD;
  if (!raw) {
    return null;
  }
  const unitPrice = Number(raw);
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    return null;
  }
  // numeric(10,4) kolonuna uygun yuvarlama.
  return Math.round(fetchedReviews * unitPrice * 10_000) / 10_000;
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
