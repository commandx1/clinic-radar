-- ============ service_role: competitors UPDATE grant ============
-- bkz. docs/03-database.md, CLAUDE.md "rolbypassrls GRANT yerine geçmez".
--
-- Bug (2026-08-23 uçtan uca smoke testinde yakalandı): `20260711000000_service_role_grants.sql`
-- `competitors` tablosuna yalnızca SELECT verdi, ama cron pipeline'ı bu tabloya
-- fiilen YAZIYOR:
--   1. `resolve-trustpilot-refs.ts` → competitors.trustpilot_domain / trustpilot_checked_at
--      (Pro işletmelerin haftalık cron koşusunda; şimdiye kadar sessizce
--      "permission denied" alıp her döngüde aynı Apify aramasını tekrar tetikliyordu
--      — cache hiç yazılamadığı için maliyet de boşa gidiyordu),
--   2. `recent-ratings.ts` → competitors.recent_rating / _reviews / _window_days / _updated_at
--      (Faz 2.7, plan bağımsız — canlı puan hiç kalıcılaşmıyordu).
--
-- `authenticated` tarafında hem GRANT hem "competitors update own" RLS policy'si
-- zaten vardı, bu yüzden manuel (kullanıcı oturumlu) analiz akışı etkilenmiyordu;
-- hata yalnızca service-role ile çalışan cron yolunda görülüyordu.

grant update on public.competitors to service_role;
