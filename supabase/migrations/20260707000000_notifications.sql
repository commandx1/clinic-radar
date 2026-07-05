-- ============ Bildirimler (Faz 1.1) ============
-- bkz. docs/02-business-rules.md Bölüm G — üç bildirim kuralı:
--   1) Yeni görev oluştuğunda  -> 'competitor_review_delta' (haftalık özete dahil, anlık yok)
--   2) 60 günde otomatik dismissed -> 'task_auto_dismissed' (haftalık özete dahil)
--   3) Kritik sinyal (mention_count haftada 3x artışı, Pro) -> 'theme_spike' (anlık gönderilir)
-- Satırlar salt kayıt/audit amaçlı; e-posta gönderimi cron tarafında (weekly-digest
-- ve theme_spike için weekly-analysis cron'u içinde anlık) tetiklenir ve emailed_at
-- ile işaretlenir (idempotent — aynı bildirim iki kez e-postalanmaz).
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  type text not null check (type in ('competitor_review_delta', 'theme_spike', 'task_auto_dismissed')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  emailed_at timestamptz
);

create index notifications_business_emailed_created_idx
  on public.notifications (business_id, emailed_at, created_at);

alter table public.notifications enable row level security;

-- Yalnızca SELECT policy — INSERT/UPDATE/DELETE için kasıtlı olarak politika
-- YOK. Yazma işlemleri sadece cron service-role client'ı üzerinden yapılır
-- (bkz. src/lib/supabase/admin.ts), bu client RLS'i tamamen atlar; kullanıcı
-- oturumundan (authenticated role) hiçbir yazma yolu açılmamalı.
create policy "notifications select own" on public.notifications
  for select using (public.is_business_owner(business_id));

grant select on public.notifications to authenticated;
