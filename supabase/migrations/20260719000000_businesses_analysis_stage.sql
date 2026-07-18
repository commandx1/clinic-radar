-- ============ İşletme: Canlı Analiz Aşaması ============
-- bkz. docs/03-database.md, docs/05-ai-pipeline.md
--
-- "Analizi Çalıştır" pipeline'ı uzun sürebildiği için UI'ın mutation pending
-- iken kullanıcıya aşama bazlı ilerleme gösterebilmesi gerekiyor. Pipeline her
-- aşamaya girerken bu sütunu günceller; analiz yokken veya bitince/hata alınca
-- NULL'a döner. CHECK constraint ile geçerli değerler sınırlanır.

alter table public.businesses
  add column analysis_stage text;

alter table public.businesses
  add constraint businesses_analysis_stage_check
  check (analysis_stage in ('scraping', 'themes', 'gap', 'tasks', 'summary'));
