-- ============ Rakip bazlı tema saklama ============
-- bkz. docs/10-roadmap.md Faz 1.2 madde 3, docs/03-database.md
--
-- theme_summary.owner_type='competitor' satırları şimdiye kadar TÜM seçili
-- rakiplerin toplamıydı (competitor_id kolonu yoktu). Bu migration nullable
-- bir competitor_id ekler:
--   - owner_type='own'                         -> her zaman NULL
--   - owner_type='competitor', competitor_id IS NULL     -> toplulaştırılmış satır (mevcut davranış, DEĞİŞMEDİ)
--   - owner_type='competitor', competitor_id IS NOT NULL -> o tek rakibin kendi mention kırılımı (YENİ)
-- Skorlama/filtreleme/bildirim/Themes-sayfası hâlâ competitor_id IS NULL
-- satırını okur; rakip bazlı satırlar yalnızca görev kartı kanıt satırı içindir.

alter table public.theme_summary
  add column competitor_id uuid references public.competitors (id) on delete cascade;

create index theme_summary_business_owner_competitor_theme_idx
  on public.theme_summary (business_id, owner_type, competitor_id, theme);
