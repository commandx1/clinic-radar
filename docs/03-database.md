# 03 — Veritabanı Şeması

Önerilen: **PostgreSQL** (Supabase — auth, db, storage tek serviste, Row Level Security ile kullanıcı verisi izolasyonu kolay).

```sql
-- ============ Kullanıcılar & Plan ============

users (
  id uuid primary key,
  email text unique,
  created_at timestamptz
)

subscriptions (
  id uuid primary key,
  user_id uuid references users(id),
  plan text,                 -- 'free' | 'pro' | 'agency'
  status text,                -- 'active' | 'canceled' | 'past_due'
  current_period_end timestamptz,
  lemonsqueezy_customer_id text,            -- LemonSqueezy customer.id, webhook'tan set edilir
  lemonsqueezy_subscription_id text unique, -- LemonSqueezy subscription.id, sonraki webhook eventlerini eşleştirmek için
  lemonsqueezy_variant_id text,             -- plan'ı türetmek için kullanılan variant ID (bkz. 04-api.md webhook)
  lemonsqueezy_customer_portal_url text     -- LemonSqueezy'nin kendi billing-management sayfası, UI'da doğrudan link olarak kullanılır
)

-- ============ İşletme ============

businesses (
  id uuid primary key,
  user_id uuid references users(id),          -- unique: Free/Pro'da kullanıcı başına 1 işletme (bkz. 02-business-rules.md Bölüm A)
  google_place_id text unique,
  name text,
  category text,               -- Google'ın ham kategorisi
  normalized_category text,    -- eşleştirme sonrası normalize kategori (bkz. Açık Sorular)
  lat float, lng float,
  geo_cell text,                -- geohash(lat,lng, precision=6), app tarafında hesaplanır (bkz. region_category_cache.geo_cell ile aynı fonksiyon)
  rating float,
  review_count int,
  last_scraped_at timestamptz,
  current_tool text,           -- onboarding zorunlu sorusu "şu an rakip/itibar takibi için ne kullanıyorsunuz?" (11-risks-assumptions.md Bölüm B/E); DB'de nullable (eski satırlar), zorunluluk app katmanında
  monthly_report_emailed_at timestamptz  -- Monthly Report e-postası son gönderim zamanı (02-business-rules.md Bölüm G), idempotency için
)

clinic_score_history (
  id uuid primary key,
  business_id uuid references businesses(id),
  score int,                   -- Clinic Score (0-100), bkz. 09-task-engine.md
  competitor_rank int,
  executive_summary jsonb,     -- {tr, en} | null — Aşama 3 çıktısı (05-ai-pipeline.md); başarısızlıkta null, UI o zaman kartı gizler
  snapshot_at timestamptz      -- haftalık snapshot, trend grafiği için
)

-- ============ Rakip Keşfi & Cache ============

region_category_cache (
  id uuid primary key,
  normalized_category text,
  geo_cell text,                -- geohash(lat,lng, precision=6)
  candidates jsonb,             -- ham aday listesi (place_id, name, rating, review_count...)
  fetched_at timestamptz,
  ttl_expires_at timestamptz    -- bkz. 02-business-rules.md Bölüm C
)

competitors (
  id uuid primary key,
  business_id uuid references businesses(id),
  google_place_id text,
  name text,
  rating float,
  review_count int,
  selected_at timestamptz
)

-- ============ Yorumlar ============

reviews (
  id uuid primary key,
  review_id text,               -- Google'ın kendi review ID'si (dedup için)
  place_id text,
  owner_type text,               -- 'own' | 'competitor'
  business_id uuid,              -- own ise businesses.id, competitor ise competitors.id
  author_name text,
  rating int,
  text text,
  original_language text,
  translated_text text,          -- Faz 2 çok dilli analiz, Faz 1'de null
  owner_reply text,
  images_count int,
  likes int,
  is_local_guide boolean,
  review_url text,
  published_at timestamptz,
  scraped_at timestamptz
)

-- ============ Analiz Katmanı (iki seviyeli) ============

-- Ham analiz: her yorum için Claude'un çıkardığı sinyaller
review_analysis (
  id uuid primary key,
  review_id uuid references reviews(id),
  theme text,
  emotion text,                  -- sentiment detayı: 'frustrated' | 'satisfied' | 'neutral' vb.
  urgency text,                  -- 'low' | 'medium' | 'high'
  confidence float,
  analyzed_at timestamptz
)

-- Toplulaştırılmış tema özeti: dashboard ve görev üretimi bunu okur
theme_summary (
  id uuid primary key,
  business_id uuid references businesses(id),  -- her zaman kullanıcının kendi işletmesi; owner_type kimin yorumlarının özetlendiğini ayırt eder
  owner_type text,               -- 'own' | 'competitor' — competitor_id NULL olan 'competitor' satırları TEK bir rakibi değil, TÜM seçili rakiplerin toplamını temsil eder
  competitor_id uuid references competitors(id),  -- Faz 1.2: dolu ise bu satır TEK bir rakibe özel (görev kartı "N rakibinden M'i güçlü" kırılımı için); own satırlarda ve toplulaştırılmış competitor satırında NULL — bkz. 05-ai-pipeline.md, 09-task-engine.md
  theme text,
  treatment text,                -- Faz 2: tema belirli bir tedavi/hizmet türüyle ilişkiliyse serbest metin (implant, botoks vb.), genel bir temaysa null — bkz. 05-ai-pipeline.md Aşama 1, 08-dashboard.md Treatments
  positive_mentions int,
  negative_mentions int,
  trend text,                    -- 'improving' | 'worsening' | 'stable' | null — AI değil, kod tarafında döngüler arası negatif oran deltasından hesaplanır (02-business-rules.md Bölüm C)
  severity text,                 -- 'normal' | 'critical', default 'normal' — Aşama 1 modeli sağlık/güvenlik zararı, ciddi etik/yasal risk ya da dolandırıcılık iddiası içeren EN AZ BİR yorum tespit ederse 'critical'; own tarafında bu, mention sayısından bağımsız olarak görev üretim eşiğini atlar (02-business-rules.md Bölüm D)
  period_start date,
  period_end date,
  updated_at timestamptz
)

-- ÖNEMLİ: competitor_id dolu (rakip bazlı kırılım) satırlar owner_type='competitor'
-- toplulaştırılmış satırıyla AYNI theme/owner_type'a sahip olabilir — bu tabloyu
-- okuyan her yeni kod `competitor_id IS NULL` filtresi eklemeli, aksi halde
-- competitor sayıları çift sayılır/yanlış satırla ezilir (Themes sayfasında
-- yaşanmış gerçek bir bug, bkz. docs/10-roadmap.md Faz 2 notu).

-- ============ Analiz Koşuları ============

-- Her analysis/run çağrısının (manuel veya cron) yaşam döngüsü kaydı:
-- cron dedup/gözlemlenebilirlik için. Cron service role ile yazar (RLS muaf);
-- manuel rota authed client ile yazar — is_business_owner tabanlı
-- select/insert/update policy'leri vardır, delete policy bilinçli olarak yoktur
-- (koşu kayıtları denetim izidir). bkz. 05-ai-pipeline.md.
analysis_runs (
  id uuid primary key,
  business_id uuid references businesses(id),
  trigger text,                -- 'manual' | 'cron'
  status text,                 -- 'running' | 'succeeded' | 'failed'
  error text,                  -- status='failed' ise hata mesajı, aksi halde null
  started_at timestamptz,
  finished_at timestamptz,     -- koşu bitene kadar null
  scrape_success boolean,      -- Apify job'ı başarılı mı; scrape hiç denenmediyse (örn. insufficient_competitors) null — Risk 3 sinyali (11-risks-assumptions.md)
  fetched_reviews int,         -- Apify'dan dönen ham yorum sayısı (yorum başına maliyet trendinin paydası)
  scrape_latency_ms int,       -- fetchReviewsForPlaces duvar saati süresi
  scrape_cost_usd numeric      -- tahmini maliyet: fetched_reviews × APIFY_PRICE_PER_REVIEW_USD; env tanımsızsa null (run-sync yanıtı gerçek usage taşımaz)
)

-- ============ Görevler ============

tasks (
  id uuid primary key,
  business_id uuid references businesses(id),
  title_i18n jsonb,               -- {tr: string, en: string}, not null — bkz. 06-prompts.md Aşama 2
  description_i18n jsonb,         -- {tr: string, en: string} | null, aynı şekil
  based_on_competitor_id uuid,   -- source_type='absolute_quality' ise null olabilir
  source_type text,              -- 'competitive_gap' | 'absolute_quality', bkz. 02-business-rules.md Bölüm D
  theme text,
  impact_score int,              -- 0-100, bkz. 09-task-engine.md
  effort_score int,              -- 1-5, bkz. 09-task-engine.md
  priority text,                 -- 'high' | 'medium' | 'low' (impact/effort'tan türetilir)
  status text,                   -- 'open' | 'done' | 'dismissed'
  created_at timestamptz,
  last_priority_recalc_at timestamptz,
  completed_at timestamptz
)
```

## Yetkilendirme (RLS + GRANT)
Her tabloda RLS açık ve `authenticated` rolüne satır bazlı policy'lerle eşleşen `grant`'lar veriliyor. **Önemli:** `service_role`'ün `rolbypassrls=true` olması yalnızca RLS policy değerlendirmesini atlar, Postgres'in tablo düzeyindeki `GRANT` kontrolünü atlamaz — ikisi ayrı mekanizma. `20260711000000_service_role_grants.sql`, cron pipeline'ının (`run-cron-analysis-cycle.ts`, `execute-analysis.ts`, `run-daily-maintenance.ts`, `auto-dismiss.ts`, `weekly-digest.ts`, `record-notification.ts`) fiilen dokunduğu tablo/operasyon çiftlerine `service_role` grant'ı ekler — bu olmadan admin client her sorguda "permission denied" alıyordu (Faz 1.2 sonunda keşfedilip düzeltildi). Yeni bir tablo eklerken cron veya `scripts/*.ts` bakım script'lerinden erişilecekse aynı migration'da `service_role`'e de grant vermeyi unutma.

## İndeks önerileri
- `reviews(business_id, owner_type, published_at)` — trend sorguları için.
- `region_category_cache(normalized_category, geo_cell)` unique — cache lookup için.
- `tasks(business_id, status)` — dashboard task listesi için.
- `analysis_runs(business_id)` ve `analysis_runs(started_at desc)` — cron dedup ("bu hafta koşuldu mu?") ve son koşu sorguları için.

## Kategori normalizasyonu (Faz 1 kararı)
Google kategorileri tutarsız ("Dentist" vs "Cosmetic dentist" vs "Orthodontist") — ve ürün global olduğu için bu etiketler Google'ın döndürdüğü **yerel dilde** de gelir (ör. "Zahnarzt", "Diş Hekimi", "Dentiste"). Faz 1'de bu bir DB tablosu değil, kod içinde statik bir eşleştirme (`src/lib/category/normalize.ts`, `CATEGORY_ALIASES` map) olarak tutulur — yaşayan/genişleyen bir liste, tek seferlik bir teslimat değil. Eşlenmeyen bir ham kategori (`trim().toLowerCase()` sonrası map'te yoksa) kendi değerine normalize edilir, yani sadece birebir aynı yazılmış diğer kayıtlarla eşleşir, farklı dildeki eşdeğeriyle otomatik eşleşmez — bu kabul edilen bir MVP sınırlamasıdır. Belirsiz/çok dilli durumlarda Claude'a "bu iki kategori aynı iş kolunda mı" sorusu sorulması (dilden bağımsız çalışır) Faz 1.1'e bırakılmıştır.
