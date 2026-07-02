-- ============ İşletme ============
-- bkz. docs/03-database.md

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  google_place_id text unique,
  name text not null,
  category text,
  normalized_category text,
  lat double precision,
  lng double precision,
  rating double precision,
  review_count int,
  last_scraped_at timestamptz
);

create index businesses_user_id_idx on public.businesses (user_id);

create table public.clinic_score_history (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  score int check (score between 0 and 100),
  competitor_rank int,
  snapshot_at timestamptz not null default now()
);

-- Diğer tüm tablolarda RLS için ortak sahiplik kontrolü.
create function public.is_business_owner(target_business_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.businesses
    where id = target_business_id and user_id = auth.uid()
  );
$$;

alter table public.businesses enable row level security;
alter table public.clinic_score_history enable row level security;

create policy "businesses select own" on public.businesses
  for select using (user_id = auth.uid());

create policy "businesses insert own" on public.businesses
  for insert with check (user_id = auth.uid());

create policy "businesses update own" on public.businesses
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "businesses delete own" on public.businesses
  for delete using (user_id = auth.uid());

create policy "clinic_score_history select own" on public.clinic_score_history
  for select using (public.is_business_owner(business_id));

grant select, insert, update, delete on public.businesses to authenticated;
grant select on public.clinic_score_history to authenticated;
