-- ============ Analiz Koşuları: "Bu analizde ne değişti" Deltası ============
-- bkz. docs/05-ai-pipeline.md, docs/08-dashboard.md, docs/03-database.md
--
-- Overview sayfasındaki "Bu analizde ne değişti" kartı için her koşunun bir
-- önceki (succeeded/partial) koşuya göre yapılandırılmış özetini saklar.
-- Şekil src/lib/analysis/analysis-delta.ts'teki AnalysisDelta arayüzüyle
-- eşleşir (jsonb içindeki "version" alanı ileride şekil değişirse geriye
-- dönük okumayı kolaylaştırır). Sadece succeeded/partial run'larda dolu
-- yazılır; running/failed run'larda null kalır.
alter table public.analysis_runs
  add column delta jsonb;
