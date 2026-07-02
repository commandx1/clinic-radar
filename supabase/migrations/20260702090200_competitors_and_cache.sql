-- ============ Rakip Keşfi & Cache ============
-- bkz. docs/03-database.md, docs/02-business-rules.md Bölüm C

create table public.region_category_cache (
  id uuid primary key default gen_random_uuid(),
  normalized_category text not null,
  geo_cell text not null,
  candidates jsonb not null default '[]'::jsonb,
  fetched_at timestamptz not null default now(),
  ttl_expires_at timestamptz not null
);

create unique index region_category_cache_category_cell_idx
  on public.region_category_cache (normalized_category, geo_cell);

create table public.competitors (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  google_place_id text not null,
  name text not null,
  rating double precision,
  review_count int,
  selected_at timestamptz not null default now()
);

create index competitors_business_id_idx on public.competitors (business_id);

alter table public.region_category_cache enable row level security;
alter table public.competitors enable row level security;

-- Cache kullanıcıya özel değil, herhangi bir authenticated kullanıcı okuyabilir.
-- Yazma discovery job'una (service role) bırakılır, bu slice'ta implement edilmiyor.
create policy "region_category_cache select authenticated" on public.region_category_cache
  for select using (auth.role() = 'authenticated');

create policy "competitors select own" on public.competitors
  for select using (public.is_business_owner(business_id));

create policy "competitors insert own" on public.competitors
  for insert with check (public.is_business_owner(business_id));

create policy "competitors update own" on public.competitors
  for update using (public.is_business_owner(business_id)) with check (public.is_business_owner(business_id));

create policy "competitors delete own" on public.competitors
  for delete using (public.is_business_owner(business_id));

grant select on public.region_category_cache to authenticated;
grant select, insert, update, delete on public.competitors to authenticated;
