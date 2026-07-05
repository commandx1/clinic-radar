-- ============ İşletme: Onboarding "şu an ne kullanıyorsunuz?" ============
-- bkz. docs/11-risks-assumptions.md Bölüm B/E — Birdeye/Podium rekabet
-- riskinin erken sinyali: onboarding'de zorunlu soru, churn görüşmelerinde
-- frekansı izlenir.
--
-- DB'de nullable: mevcut satırların cevabı yoktur ve backfill anlamsızdır.
-- Zorunluluk uygulama katmanında (createBusinessSchema) uygulanır.
-- RLS: businesses'ın mevcut owner policy'leri satır bazlı olduğu için yeni
-- kolonu da kapsar; ek policy gerekmez.

alter table public.businesses
  add column current_tool text;  -- serbest metin onboarding cevabı
