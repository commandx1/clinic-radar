-- clinic_score_history yazma politikası — bkz. docs/09-task-engine.md (Clinic Score
-- snapshot'ı her analysis/run çağrısı sonunda yazılır), CLAUDE.md (RLS her zaman
-- açık, service-role bypass yok). 20260702090100_businesses.sql sadece select
-- politikası tanımlamıştı.

create policy "clinic_score_history insert own" on public.clinic_score_history
  for insert with check (public.is_business_owner(business_id));

grant insert on public.clinic_score_history to authenticated;
