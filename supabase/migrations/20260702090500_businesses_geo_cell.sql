-- ============ businesses.geo_cell + bölge yoğunluğu ============
-- bkz. docs/03-database.md, docs/02-business-rules.md Bölüm C
--
-- geo_cell, geohash(lat,lng,precision=6) — app tarafında (src/lib/geo/geohash.ts)
-- hesaplanıp yazılır (Postgres generated column DEĞİL — aynı hesaplamanın
-- SQL'de yeniden yazılmasını, dolayısıyla iki farklı implementasyonun drift
-- riskini önlemek için). region_category_cache.geo_cell ile aynı fonksiyon
-- kullanılır.

alter table public.businesses add column geo_cell text;
create index businesses_geo_cell_idx on public.businesses (geo_cell);

-- Cache TTL yoğunluk kuralı (Bölüm C: aynı geo_cell'de <5 aktif kullanıcı
-- varsa TTL 14 gün) için sayım gerekiyor, ama businesses select RLS'i
-- sadece sahibine izin veriyor — başka kullanıcıların satırlarını ifşa
-- etmeden sadece bir COUNT döndüren security definer fonksiyon kullanılır
-- (is_business_owner ile aynı desen, bkz. 20260702090100_businesses.sql).
create function public.count_businesses_in_geo_cell(target_geo_cell text)
returns bigint
language sql
security definer
stable
set search_path = public
as $$
  select count(*) from public.businesses where geo_cell = target_geo_cell;
$$;

grant execute on function public.count_businesses_in_geo_cell(text) to authenticated;
