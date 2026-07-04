-- ============ region_category_cache yazma politikası ============
-- bkz. docs/02-business-rules.md Bölüm B/C
--
-- region_category_cache paylaşılan (kullanıcıya özel olmayan) referans
-- verisidir, ama yazma iznini kör bir şekilde "her authenticated kullanıcı"
-- ile açmak cache poisoning'e izin verir (herhangi bir kullanıcı, hiç
-- ilişkisi olmayan bir geo_cell/kategori kombinasyonu için sahte candidate
-- listesi yazabilir). Route handler'lar service-role kullanmadığı için
-- (CLAUDE.md: "route handler'larda service-role key kullanılmaz"), yazma
-- izni sahiplik bazlı daraltılır: bir kullanıcı sadece KENDİ business'ının
-- geo_cell + normalized_category kombinasyonuna denk gelen cache satırını
-- yazabilir/güncelleyebilir — discover endpoint'i zaten cache'i her zaman
-- çağıranın kendi business'ının bu iki alanıyla upsert ettiği için işlevsel
-- bir kısıtlama getirmez, sadece rastgele satır yazımını engeller.
-- select politikası zaten var (20260702090200_competitors_and_cache.sql).

create policy "region_category_cache insert own_geo_cell" on public.region_category_cache
  for insert
  with check (
    exists (
      select 1 from public.businesses b
      where b.user_id = auth.uid()
        and b.geo_cell = region_category_cache.geo_cell
        and b.normalized_category = region_category_cache.normalized_category
    )
  );

create policy "region_category_cache update own_geo_cell" on public.region_category_cache
  for update
  using (
    exists (
      select 1 from public.businesses b
      where b.user_id = auth.uid()
        and b.geo_cell = region_category_cache.geo_cell
        and b.normalized_category = region_category_cache.normalized_category
    )
  )
  with check (
    exists (
      select 1 from public.businesses b
      where b.user_id = auth.uid()
        and b.geo_cell = region_category_cache.geo_cell
        and b.normalized_category = region_category_cache.normalized_category
    )
  );

grant insert, update on public.region_category_cache to authenticated;

-- Savunma derinliği: sahiplik kontrolünü geçen bir kullanıcı bile candidates
-- dizisini aşırı büyütüp cache satırını şişiremesin (DISCOVERY_FETCH_BUFFER=20
-- normal üst sınır, 50 makul bir tavan).
alter table public.region_category_cache
  add constraint region_category_cache_candidates_size check (jsonb_array_length(candidates) <= 50);
