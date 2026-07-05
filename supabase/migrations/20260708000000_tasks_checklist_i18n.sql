-- bkz. docs/10-roadmap.md — "Checklist alt adımlar + tamamlanma kriterleri".
-- Her görev için Aşama 2'de üretilen 3-5 somut alt adım; her biri
-- {tr, en, done} şeklinde saklanır. Görev güncellenirken (aynı tema+source_type
-- açık görev varsa) checklist ÜZERİNE YAZILMAZ — kullanıcının işaretlediği
-- ilerleme korunur (bkz. src/lib/analysis/execute-analysis.ts upsertTasks).
alter table public.tasks
  add column if not exists checklist_i18n jsonb;
