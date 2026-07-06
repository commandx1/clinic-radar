-- ============ Kritik Tekil Yorum Sinyali ============
-- bkz. docs/02-business-rules.md Bölüm D, docs/06-prompts.md Aşama 1, docs/09-task-engine.md
--
-- Aşama 1 modeli artık her tema için sağlık/güvenlik zararı, ciddi bir etik/
-- yasal risk ya da dolandırıcılık iddiası içeren bir yorum tespit ettiğinde
-- temayı 'critical' olarak işaretleyebiliyor. Bu, mention_count'tan bağımsız
-- bir sinyal — tek bir ciddi yorum bile (mention_count=1) TASK_MENTION_THRESHOLD
-- eşiğini atlayıp görev üretebilsin diye eklendi (mevcut eşik sadece frekansı
-- ölçüyordu, ciddiyeti değil).
alter table public.theme_summary
  add column severity text not null default 'normal' check (severity in ('normal', 'critical'));
