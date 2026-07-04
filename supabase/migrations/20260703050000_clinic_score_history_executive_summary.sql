-- Aşama 3 (Executive Summary) çıktısı — {tr, en} | null, bkz. docs/03-database.md
-- Mevcut insert policy (is_business_owner) ve table-level grant yeni kolonu kapsıyor,
-- ek RLS/grant değişikliği gerekmez.
alter table public.clinic_score_history add column executive_summary jsonb;
