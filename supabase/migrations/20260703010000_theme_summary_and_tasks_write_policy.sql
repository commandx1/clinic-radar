-- ============ theme_summary & tasks yazma politikası ============
-- bkz. docs/05-ai-pipeline.md, docs/06-prompts.md, docs/09-task-engine.md
--
-- Bu iki tablo şu ana kadar sadece select edilebiliyordu
-- (20260702090400_theme_summary_and_tasks.sql). AI pipeline (Aşama 1 + Aşama 2)
-- artık route handler'dan (service-role DEĞİL, authenticated session ile)
-- bunlara yazacak. business_id her iki tabloda da her zaman businesses.id'e
-- işaret eder (reviews'daki gibi polimorfik değil), bu yüzden mevcut
-- is_business_owner(business_id) fonksiyonu yeterli.
--
-- theme_summary: her analiz döngüsünde bir owner_type için delete-then-reinsert
-- yapılacak (competitors tablosundaki mevcut desenle aynı), bu yüzden insert +
-- delete gerekiyor.
--
-- tasks: mevcut "tasks update status own" policy'si (20260702090400) status
-- dışındaki kolonları (title, impact_score, based_on_competitor_id vb.)
-- kısıtlamıyor — pipeline'ın açık bir görevi güncelleme ihtiyacını muhtemelen
-- zaten karşılıyor. Kesin eksik olan sadece insert (yeni görev oluşturma).

create policy "theme_summary insert own" on public.theme_summary
  for insert
  with check (public.is_business_owner(business_id));

create policy "theme_summary delete own" on public.theme_summary
  for delete
  using (public.is_business_owner(business_id));

grant insert, delete on public.theme_summary to authenticated;

create policy "tasks insert own" on public.tasks
  for insert
  with check (public.is_business_owner(business_id));

grant insert on public.tasks to authenticated;
