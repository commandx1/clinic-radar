-- ============ Abonelik: LemonSqueezy Event Sıralama Damgası ============
-- bkz. docs/04-api.md
--
-- LemonSqueezy webhook'ları en-az-bir-kez teslim eder ve SIRASIZ gelebilir:
-- retry'lar gecikmiş eski bir event'i yenisinden sonra teslim edebilir. Önceki
-- handler koşulsuz UPDATE yaptığı için, gecikmiş eski bir event (ör. bir
-- 'subscription_updated=active'ten sonra gelen bayat 'subscription_paused')
-- aktif aboneliği yanlış değerlerle ezip kullanıcıyı sessizce 'past_due'/
-- 'canceled'/'free' durumuna düşürebiliyordu = churn + yanlış erişim kaybı.
--
-- Bu sütun her subscription attributes'ındaki updated_at damgasını saklar;
-- handler UPDATE'i yalnızca gelen event stored damgadan yeni ya da eşitse
-- uygular (idempotent duplicate + sıralı guard). NULL = henüz damga yok, uygula.

alter table public.subscriptions
  add column lemonsqueezy_updated_at timestamptz;
