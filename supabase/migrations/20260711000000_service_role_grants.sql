-- ============ Service Role Grants ============
-- bkz. docs/03-database.md
--
-- Bug: `rolbypassrls` (service_role için varsayılan) yalnızca RLS policy'lerini
-- atlar, tablo düzeyindeki GRANT kontrolünü ETMEZ. Şimdiye kadarki tüm
-- migration'lar sadece `authenticated`'a GRANT veriyordu; `/api/cron/**`
-- route'larının kullandığı admin client (`src/lib/supabase/admin.ts`,
-- `createAdminClient`) bu yüzden "permission denied" ile RLS'i hiç
-- değerlendiremeden reddediliyordu (analysis_runs.sql'deki "cron zaten RLS'ten
-- muaf" yorumu yanlıştı — muafiyet için GRANT de gerekir).
--
-- Kapsam: yalnızca cron pipeline'ının (run-cron-analysis-cycle.ts,
-- execute-analysis.ts, run-daily-maintenance.ts, auto-dismiss.ts,
-- weekly-digest.ts, record-notification.ts) fiilen kullandığı
-- tablo/operasyon çiftleri — authenticated'a paralel, gereğinden geniş değil.

grant select on public.subscriptions to service_role;
grant select, update on public.businesses to service_role;
grant select on public.users to service_role;
grant select on public.competitors to service_role;
grant select, insert, update on public.analysis_runs to service_role;
grant select, insert, update on public.reviews to service_role;
grant select, insert, delete on public.theme_summary to service_role;
grant select, insert, update on public.tasks to service_role;
grant select, insert on public.clinic_score_history to service_role;
grant select, insert, update on public.notifications to service_role;
