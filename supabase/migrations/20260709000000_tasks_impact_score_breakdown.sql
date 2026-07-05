-- bkz. docs/10-roadmap.md Faz 1.2 "Impact score'un kod tarafında bileşenlerden
-- hesaplanması" ve src/lib/task-engine/impact-score.ts. impact_score artık
-- Aşama 2 modelinden gelmiyor; rakip yaygınlığı + own eksikliği + trend
-- kırılımından kod tarafında hesaplanıyor. Bu kolon kartta "neden bu skor"
-- açıklamasını göstermek için ham bileşenleri saklar.
alter table public.tasks
  add column if not exists impact_score_breakdown jsonb;
