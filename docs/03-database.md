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
  current_period_end timestamptz
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
  last_scraped_at timestamptz
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
  owner_type text,               -- 'own' | 'competitor' — 'competitor' satırları TEK bir rakibi değil, TÜM seçili rakiplerin toplamını temsil eder (rakip kimliğini tutan ayrı bir kolon yok, bkz. 05-ai-pipeline.md)
  theme text,
  positive_mentions int,
  negative_mentions int,
  trend text,                    -- 'improving' | 'worsening' | 'stable' | null — AI değil, kod tarafında döngüler arası negatif oran deltasından hesaplanır (02-business-rules.md Bölüm C)
  period_start date,
  period_end date,
  updated_at timestamptz
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

## İndeks önerileri
- `reviews(business_id, owner_type, published_at)` — trend sorguları için.
- `region_category_cache(normalized_category, geo_cell)` unique — cache lookup için.
- `tasks(business_id, status)` — dashboard task listesi için.

## Kategori normalizasyonu (Faz 1 kararı)
Google kategorileri tutarsız ("Dentist" vs "Cosmetic dentist" vs "Orthodontist") — ve ürün global olduğu için bu etiketler Google'ın döndürdüğü **yerel dilde** de gelir (ör. "Zahnarzt", "Diş Hekimi", "Dentiste"). Faz 1'de bu bir DB tablosu değil, kod içinde statik bir eşleştirme (`src/lib/category/normalize.ts`, `CATEGORY_ALIASES` map) olarak tutulur — yaşayan/genişleyen bir liste, tek seferlik bir teslimat değil. Eşlenmeyen bir ham kategori (`trim().toLowerCase()` sonrası map'te yoksa) kendi değerine normalize edilir, yani sadece birebir aynı yazılmış diğer kayıtlarla eşleşir, farklı dildeki eşdeğeriyle otomatik eşleşmez — bu kabul edilen bir MVP sınırlamasıdır. Belirsiz/çok dilli durumlarda Claude'a "bu iki kategori aynı iş kolunda mı" sorusu sorulması (dilden bağımsız çalışır) Faz 1.1'e bırakılmıştır.
