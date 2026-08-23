-- Üçüncü görev kaynağı: 'profile_gap' (bkz. docs/02-business-rules.md Bölüm D,
-- docs/09-task-engine.md, src/lib/analysis/profile-gap-candidates.ts). AI
-- çağrısı olmadan, uygulama kodunda elimizdeki veriden (yorum yanıt oranı,
-- website varlığı) deterministik üretilir.
alter table public.tasks drop constraint tasks_source_type_check;
alter table public.tasks add constraint tasks_source_type_check
  check (source_type in ('competitive_gap', 'absolute_quality', 'profile_gap'));
