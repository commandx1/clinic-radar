-- ============ Analiz Koşuları: 'partial' Durumu + Eşzamanlılık Kilidi ============
-- bkz. docs/03-database.md
--
-- Bulgu 1 (durum drift'i): cron döngüsü "partial" sonucu (bazı owner adımları
-- başarısız ama sert hata yok) 'succeeded' altında gizliyordu; böylece denetim
-- izi kısmi başarıları gerçek durumuyla göstermiyordu. status artık 'partial'
-- kabul eder.
--
-- Bulgu 2 (race): aynı işletme için eşzamanlı iki 'running' koşu (çift tıklama
-- ya da manuel + cron çakışması) 2x Apify + 2x Claude maliyeti üretiyordu.
-- business_id başına en fazla bir 'running' satırına izin veren kısmi unique
-- index bunu DB düzeyinde engeller; ikinci insert 23505 (unique_violation) ile
-- reddedilir ve çağıran taraf "already_running" olarak ele alır.

alter table public.analysis_runs
  drop constraint analysis_runs_status_check;

alter table public.analysis_runs
  add constraint analysis_runs_status_check
  check (status in ('running', 'succeeded', 'partial', 'failed'));

-- Production güvenliği: partial unique index oluşturulmadan ÖNCE, mevcut tüm
-- 'running' satırları 'failed' yapılır. Aksi halde aynı business için önceki
-- kod sürümünden kalmış takılı/çift 'running' satırları unique index oluşturmayı
-- 23505 ile başarısız yapıp migration'ı yarıda keserdi. Bir migration anında
-- meşru bir in-flight analiz olması olası değildir; olsa bile o koşu bitince
-- kendi satırını id ile günceller, dolayısıyla veri kaybı olmaz.
update public.analysis_runs
  set status = 'failed',
      error = coalesce(error, 'stale_pre_lock_migration'),
      finished_at = coalesce(finished_at, now())
  where status = 'running';

create unique index analysis_runs_one_running_per_business
  on public.analysis_runs (business_id)
  where status = 'running';
