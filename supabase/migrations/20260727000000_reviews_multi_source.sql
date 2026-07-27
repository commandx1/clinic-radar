-- ============ Yorumlar: çoklu kaynak desteği ============
-- bkz. docs/02-business-rules.md Bölüm I "Yorum Kaynakları (Multi-Source)",
-- docs/03-database.md
--
-- Tek mantıksal değişiklik: yorumlar artık Google dışında bir kaynaktan da
-- gelebilir. Bu migration YENİ bir scraper eklemez — sadece şemayı ve dedup
-- kuralını source-agnostic hale getirir. Faz 1'de fiilen tek yazılan değer
-- 'google' olmaya devam eder (davranışta bit-for-bit fark yoktur).

-- reviews.place_id -> reviews.source_ref (kaynak-agnostik isim) ve yeni
-- zorunlu reviews.source kolonu. Default BİLİNÇLİ OLARAK verilmiyor: her
-- insert kaynağını açıkça belirtmeli, sessiz varsayılan yanlış kaynağa
-- yazmayı kolaylaştırır.
alter table public.reviews add column source text;

update public.reviews set source = 'google';

alter table public.reviews alter column source set not null;

alter table public.reviews
  add constraint reviews_source_check
  check (source in ('google', 'facebook', 'trustpilot'));

alter table public.reviews rename column place_id to source_ref;

-- Eski dedup indeksi (place_id, review_id) artık kaynak-agnostik değil: iki
-- farklı platform aynı review_id şemasını paylaşabilir. (source, source_ref,
-- review_id) üçlüsü doğru dedup birimidir.
drop index public.reviews_place_review_dedup_idx;

create unique index reviews_source_dedup_idx
  on public.reviews (source, source_ref, review_id);
