-- bkz. docs/10-roadmap.md Faz 2 — Monthly Report e-posta kanalı.
-- İdempotent gönderim için son gönderim zamanı işletme başına saklanır
-- (weekly-digest'in notifications.emailed_at deseniyle aynı mantık).
alter table public.businesses
  add column monthly_report_emailed_at timestamptz;
