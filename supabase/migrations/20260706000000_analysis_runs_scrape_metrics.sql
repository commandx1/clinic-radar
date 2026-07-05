-- ============ Analiz Koşuları: Scrape Metrikleri ============
-- bkz. docs/03-database.md ve docs/11-risks-assumptions.md Risk 3 —
-- "ilk günden logla" sinyalleri: scrape başarı oranı (job bazında),
-- yorum başına maliyet trendi, scrape latency trendi.
--
-- Ayrı bir tablo yerine analysis_runs genişletmesi seçildi: her scrape zaten
-- bir koşuya bağlıdır, ayrı tablo join ve ikinci bir RLS yüzeyi ekler.
--
-- RLS kararı: yeni policy YOK. Mevcut is_business_owner tabanlı
-- select/insert/update policy'leri (20260705000001) satır bazlı çalıştığı
-- için yeni kolonları da otomatik kapsar; cron tarafı service role ile yazar
-- (RLS muaf). Maliyet alanının işletme sahibine görünür olması kabul edilen
-- bir trade-off'tur — alan zaten tahmini/toplu bir değerdir ve kolon bazlı
-- gizleme için ayrı servis-rol tablosu açmak MVP'de gereksiz karmaşıklıktır.

alter table public.analysis_runs
  add column scrape_success boolean,        -- Apify job'ı başarılı mı; scrape hiç denenmediyse (örn. insufficient_competitors) null
  add column fetched_reviews int,           -- Apify'dan dönen ham yorum sayısı — yorum başına maliyet trendinin paydası
  add column scrape_latency_ms int,         -- fetchReviewsForPlaces çağrısının duvar saati süresi
  add column scrape_cost_usd numeric(10, 4); -- tahmini maliyet: fetched_reviews × APIFY_PRICE_PER_REVIEW_USD (env tanımsızsa null) — run-sync yanıtı gerçek usage taşımaz
