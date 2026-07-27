// Adaptörler arası ortak fiyat-parse mantığı (sonarjs/no-identical-functions
// kopyalamayı engellediği için tek yere çıkarıldı) — bkz.
// src/lib/reviews/sources/google.ts, src/lib/reviews/sources/trustpilot.ts.
// env tanımsız/geçersiz/negatifse null döner; loglama sessizce maliyetsiz
// devam eder (bkz. src/lib/analysis/scrape-metrics.ts).
export function parseUnitPriceEnv(envValue: string | undefined): number | null {
  if (!envValue) {
    return null;
  }
  const unitPrice = Number(envValue);
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    return null;
  }
  return unitPrice;
}
