-- ============ Analiz Koşuları: Sahip Policy'leri ============
-- bkz. docs/03-database.md
--
-- 20260705000000_analysis_runs.sql RLS'i açmış ama policy tanımlamamıştı;
-- bu, manuel tetikleme rotasının (authed client) run kaydı yazmasını sessizce
-- engelliyordu. Plana uygun olarak is_business_owner tabanlı policy'ler eklenir.
-- Cron tarafı service role kullandığı için RLS'ten zaten muaftır.

create policy "analysis_runs_owner_select"
  on public.analysis_runs
  for select
  using (public.is_business_owner(business_id));

create policy "analysis_runs_owner_insert"
  on public.analysis_runs
  for insert
  with check (public.is_business_owner(business_id));

create policy "analysis_runs_owner_update"
  on public.analysis_runs
  for update
  using (public.is_business_owner(business_id))
  with check (public.is_business_owner(business_id));

-- delete policy bilinçli olarak YOK: koşu kayıtları denetim izidir, sahip silemez.
