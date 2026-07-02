-- ============ Yorumlar ============
-- bkz. docs/03-database.md
--
-- reviews.business_id polimorfik: owner_type='own' ise businesses.id,
-- owner_type='competitor' ise competitors.id. Tek bir FK ile ifade edilemediği
-- için sahiplik is_review_owner() ile dinamik çözülüyor (bkz. plan notu).

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  review_id text not null,
  place_id text not null,
  owner_type text not null check (owner_type in ('own', 'competitor')),
  business_id uuid not null,
  author_name text,
  rating int check (rating between 1 and 5),
  text text,
  original_language text,
  translated_text text,
  owner_reply text,
  images_count int,
  likes int,
  is_local_guide boolean,
  review_url text,
  published_at timestamptz,
  scraped_at timestamptz not null default now()
);

create index reviews_business_owner_published_idx
  on public.reviews (business_id, owner_type, published_at);

-- Google review_id + place_id kombinasyonu için dedup (doc'un niyeti, açık FK yok).
create unique index reviews_place_review_dedup_idx
  on public.reviews (place_id, review_id);

create function public.is_review_owner(target_business_id uuid, target_owner_type text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select case target_owner_type
    when 'own' then public.is_business_owner(target_business_id)
    when 'competitor' then exists (
      select 1 from public.competitors c
      where c.id = target_business_id and public.is_business_owner(c.business_id)
    )
    else false
  end;
$$;

create table public.review_analysis (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  theme text,
  emotion text,
  urgency text check (urgency in ('low', 'medium', 'high')),
  confidence double precision,
  analyzed_at timestamptz not null default now()
);

alter table public.reviews enable row level security;
alter table public.review_analysis enable row level security;

create policy "reviews select own" on public.reviews
  for select using (public.is_review_owner(business_id, owner_type));

create policy "review_analysis select own" on public.review_analysis
  for select using (
    exists (
      select 1 from public.reviews r
      where r.id = review_analysis.review_id
        and public.is_review_owner(r.business_id, r.owner_type)
    )
  );

grant select on public.reviews to authenticated;
grant select on public.review_analysis to authenticated;
