-- Görev sonuç takibi (bkz. docs/09-task-engine.md "Görev sonuç takibi",
-- docs/02-business-rules.md). Her görev, oluşturulduğu andaki ölçülebilir
-- sinyal durumunu (`outcome_baseline`) ve her sonraki analiz döngüsündeki en
-- güncel durumu (`outcome_latest`) saklar — "bu görevi tamamladıktan sonra
-- gerçekten işe yaradı mı?" sorusunun kanıtı için. Şekil kaynak tipine göre
-- değişir (theme / reply_rate / website, bkz. src/lib/task-engine/task-outcome.ts),
-- bu yüzden jsonb — ayrı kolonlara bölünmedi.
alter table public.tasks
  add column if not exists outcome_baseline jsonb,
  add column if not exists outcome_latest jsonb;
