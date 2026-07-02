-- ============ Tema Özeti & Görevler ============
-- bkz. docs/03-database.md, docs/09-task-engine.md, docs/02-business-rules.md Bölüm D
--
-- theme_summary.business_id her zaman businesses.id'e işaret eder (doc'ta FK
-- açık değil, owner_type kimin yorumlarının özetlendiğini ayırt eder).

create table public.theme_summary (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  owner_type text not null check (owner_type in ('own', 'competitor')),
  theme text not null,
  positive_mentions int not null default 0,
  negative_mentions int not null default 0,
  trend text check (trend in ('improving', 'worsening', 'stable')),
  period_start date,
  period_end date,
  updated_at timestamptz not null default now()
);

create index theme_summary_business_owner_theme_idx
  on public.theme_summary (business_id, owner_type, theme);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  title text not null,
  description text,
  based_on_competitor_id uuid references public.competitors (id) on delete set null,
  source_type text not null check (source_type in ('competitive_gap', 'absolute_quality')),
  theme text,
  impact_score int check (impact_score between 0 and 100),
  effort_score int check (effort_score between 1 and 5),
  priority text check (priority in ('high', 'medium', 'low')),
  status text not null default 'open' check (status in ('open', 'done', 'dismissed')),
  created_at timestamptz not null default now(),
  last_priority_recalc_at timestamptz,
  completed_at timestamptz
);

create index tasks_business_status_idx on public.tasks (business_id, status);

alter table public.theme_summary enable row level security;
alter table public.tasks enable row level security;

create policy "theme_summary select own" on public.theme_summary
  for select using (public.is_business_owner(business_id));

create policy "tasks select own" on public.tasks
  for select using (public.is_business_owner(business_id));

-- Görev oluşturma sunucu tarafında (gelecekteki AI pipeline slice'ı) kalır;
-- kullanıcı yalnızca status'u done/dismissed'e çevirebilir.
create policy "tasks update status own" on public.tasks
  for update using (public.is_business_owner(business_id))
  with check (
    public.is_business_owner(business_id)
    and status in ('done', 'dismissed', 'open')
  );

grant select on public.theme_summary to authenticated;
grant select, update on public.tasks to authenticated;
