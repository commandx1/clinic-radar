-- ============ reviews yazma politikası ============
-- bkz. docs/02-business-rules.md Bölüm C, docs/04-api.md (POST .../analysis/run)
--
-- reviews şu ana kadar sadece select edilebiliyordu (20260702090300_reviews_and_analysis.sql).
-- Yorum çekme adımı şimdi route handler'dan (service-role DEĞİL, authenticated
-- session ile) upsert yapacağı için insert + update politikaları gerekiyor.
-- business_id polimorfik olduğundan (owner_type='own' -> businesses.id,
-- owner_type='competitor' -> competitors.id), sahiplik zaten mevcut olan
-- is_review_owner(business_id, owner_type) fonksiyonu ile çözülüyor — aynı
-- fonksiyon select politikasında da kullanılıyor, tek doğruluk kaynağı.
--
-- Upsert (.upsert(..., { onConflict: "place_id,review_id" })) Postgres'te
-- INSERT ... ON CONFLICT DO UPDATE olarak çalışır; RLS hem insert hem update
-- yolunu kontrol eder, bu yüzden ikisi de tanımlanmalı.

create policy "reviews insert own" on public.reviews
  for insert
  with check (public.is_review_owner(business_id, owner_type));

create policy "reviews update own" on public.reviews
  for update
  using (public.is_review_owner(business_id, owner_type))
  with check (public.is_review_owner(business_id, owner_type));

grant insert, update on public.reviews to authenticated;
