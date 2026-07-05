-- ============ Analiz Koşuları ============
-- bkz. docs/03-database.md
--
-- Her analysis/run çağrısının (manuel veya cron) yaşam döngüsü kaydı.
-- Yalnızca service role yazar/okur: RLS açık ama hiçbir policy tanımlı değil,
-- böylece authenticated/anon rollerin erişimi tamamen kapalı kalır.

create table public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  trigger text not null check (trigger in ('manual', 'cron')),
  status text not null check (status in ('running', 'succeeded', 'failed')),
  error text,                                      -- status='failed' ise hata mesajı, aksi halde null
  started_at timestamptz not null default now(),
  finished_at timestamptz                          -- koşu bitene kadar null
);

-- Cron dedup ("bu hafta koşuldu mu?") ve son koşu sorguları için.
create index analysis_runs_business_id_idx
  on public.analysis_runs (business_id);

create index analysis_runs_started_at_idx
  on public.analysis_runs (started_at desc);

-- RLS: policy YOK — yalnızca service role erişir.
alter table public.analysis_runs enable row level security;
