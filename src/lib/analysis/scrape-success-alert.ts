import { SCRAPE_SUCCESS_RATE_ALERT_THRESHOLD } from "@/lib/constants";

// bkz. docs/11-risks-assumptions.md Risk 3 / Bölüm E "Scrape eşik alarmları"
// — runCronAnalysisCycle döngü sonunda scrape başarı oranını hesaplar ve
// eşiğin altına düşerse tek bir yapılandırılmış console.error alarmı basar.
// Eşik mantığı, Supabase/cron bağlamından bağımsız test edilebilsin diye
// pure fonksiyonlar olarak buraya ayrıldı.

// processed=0 iken (hiçbir işletme denenmediyse) oran anlamsızdır — null
// döner ki çağıran taraf bunu "hiç deneme yok" ile "tam başarı" (1) ile
// karıştırmasın.
export function computeScrapeSuccessRate(scrapeSuccessCount: number, processed: number): number | null {
  return processed > 0 ? scrapeSuccessCount / processed : null;
}

// En az bir işletme denenmiş (processed >= 1) VE oran eşiğin altındaysa
// alarm tetiklenir. Maliyet 2x alarmı henüz kapsamda değil (bkz.
// docs/11-risks-assumptions.md Bölüm E).
export function shouldAlertScrapeSuccess(rate: number | null, processed: number): boolean {
  return processed >= 1 && rate !== null && rate < SCRAPE_SUCCESS_RATE_ALERT_THRESHOLD;
}
