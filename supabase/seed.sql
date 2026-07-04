-- Yerel geliştirme için tekrarlanabilir test verisi.
-- `supabase db reset` her çalıştığında otomatik uygulanır (Supabase CLI
-- konvansiyonu) — böylece elle oluşturulmuş bir test kullanıcısı/business/
-- competitor seti her reset'te silinip yeniden elle kurulmak zorunda kalmaz.
--
-- Business ve competitor verisi gerçek Mersin diş/ortodonti işletmelerinden
-- (discover + place-details Apify çağrılarıyla) alındı — own business
-- bilinçli olarak düşük puanlı (Akamine's Oral Health, 4.0★) seçildi, 3
-- rakip ise yüksek puanlı (5.0★) seçildi — böylece hem "absolute_quality"
-- (kendi zayıf temaları) hem "competitive_gap" (rakip üstünlüğü) görev
-- türlerini gerçek veriyle test edebiliyoruz. Mersin bölgesinde ≥100 yorumlu
-- gerçek adaylar arasında 3.5★ altı bulunamadı (discovery'nin kendi review
-- eşiği düşük puanlı/az yorumlu yerleri zaten eliyor) — 4.0★ en düşük gerçek
-- aday oldu.

-- ============ Auth kullanıcısı ============
-- email: test@clinicradar.local, şifre: test1234
-- public.users + public.subscriptions, auth.users insert'i üzerindeki
-- on_auth_user_created trigger'ı ile otomatik oluşur (20260702090000_extensions_and_users.sql).

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, last_sign_in_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated',
  'authenticated',
  'test@clinicradar.local',
  crypt('test1234', gen_salt('bf')),
  now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(), now(),
  '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  '11111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  format(
    '{"sub":"%s","email":"%s"}',
    '11111111-1111-1111-1111-111111111111',
    'test@clinicradar.local'
  )::jsonb,
  'email',
  now(), now(), now()
);

-- ============ Business (gerçek place verisi — Akamine's Oral Health, 4.0★) ============

insert into public.businesses (
  id, user_id, google_place_id, name, category, normalized_category,
  lat, lng, geo_cell, rating, review_count
) values (
  '22222222-2222-2222-2222-222222222222',
  '11111111-1111-1111-1111-111111111111',
  'ChIJ4Z6PjzCLJxURIK5I4vZSp0g',
  'Akamine''s Oral Health',
  'Dental clinic',
  'dentist',
  36.7804645,
  34.5870128,
  'sy895p',
  4,
  162
);

-- ============ Competitors (gerçek, yüksek puanlı Mersin rakipleri) ============

insert into public.competitors (business_id, google_place_id, name, rating, review_count)
values
  ('22222222-2222-2222-2222-222222222222', 'ChIJuyQ9-8Y2dkARwERECh_InEk', 'Mersin Ortodonti Uzmanı Yrd Doç Hatice Akıncı Cansunar (invisaling, diş teli, şeffaf plak)', 5, 666),
  ('22222222-2222-2222-2222-222222222222', 'ChIJQT_CSy6LJxURwdsKnmO4X94', 'Mersin Ortodonti Uzmanı Feyza BOZKURT KOÇAK (Invisalign, şeffaf plak, diş teli tedavisi)', 5, 323),
  ('22222222-2222-2222-2222-222222222222', 'ChIJ55_0-Nv1JxURxgFKN7i3tJQ', 'UZMANDENT Mersin Ortodonti Uzmanı Mehtap KURT KARAÇAY (İnvisalign Şeffaf Plak-Erişkin -Çocuk Tel Tedavisi )', 5, 156);
