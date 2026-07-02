-- Extensions
create extension if not exists pgcrypto;

-- ============ Kullanıcılar & Plan ============
-- bkz. docs/03-database.md

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique not null,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro', 'agency')),
  status text not null default 'active' check (status in ('active', 'canceled', 'past_due')),
  current_period_end timestamptz
);

alter table public.users enable row level security;
alter table public.subscriptions enable row level security;

create policy "users select own" on public.users
  for select using (id = auth.uid());

create policy "subscriptions select own" on public.subscriptions
  for select using (user_id = auth.uid());

-- RLS politikaları başlı başına yetmez, Postgres ayrıca role-level GRANT ister.
grant select on public.users to authenticated;
grant select on public.subscriptions to authenticated;

-- Her yeni auth.users kaydında public.users + default free/active subscription oluştur.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, new.email);

  insert into public.subscriptions (user_id, plan, status)
  values (new.id, 'free', 'active');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
