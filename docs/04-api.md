# 04 — API Tasarımı

Next.js API routes (veya ayrı Node servisi) üzerinden REST. Tüm endpoint'ler auth (Supabase session) gerektirir, `/api/public/*` hariç.

## Onboarding

| Method | Path | Açıklama |
|---|---|---|
| POST | `/api/business` | Google Place ID ile kullanıcının kendi işletmesini bağlar. Apify'dan temel veri çeker, `businesses` tablosuna yazar. |
| GET | `/api/business/:id/competitors/discover` | `region_category_cache`'i kontrol eder, gerekirse Apify Google Maps Scraper'ı tetikler (bkz. `05-ai-pipeline.md`), 10 aday döner (`02-business-rules.md` Bölüm B kurallarına göre). |
| POST | `/api/business/:id/competitors` | Kullanıcının checkbox ile seçtiği rakip listesini kaydeder (`competitors` tablosuna yazar). Min 3, max 10 validasyonu (Bölüm A). |
| POST | `/api/business/:id/analysis/run` | Seçilen rakipler + kendi işletme için yorum çekme + analiz pipeline'ını tetikler (async job). |

## Görevler

| Method | Path | Açıklama |
|---|---|---|
| GET | `/api/business/:id/tasks` | Görev listesini `status`, `priority` filtreleriyle döner. |
| PATCH | `/api/tasks/:id` | Durum güncelleme (`open` → `done` / `dismissed`). |
| GET | `/api/business/:id/tasks/history` | Tamamlanan/reddedilen görevlerin geçmişi (Faz 1.1). |

## Dashboard

| Method | Path | Açıklama |
|---|---|---|
| GET | `/api/business/:id/overview` | Executive özet: Clinic Score, Competitor Rank, Critical Issues sayısı, tamamlanan görev oranı, Potential Rating Gain (bkz. `08-dashboard.md`). |
| GET | `/api/business/:id/themes` | `theme_summary` tablosundan kendi vs rakip kırılımı. |
| GET | `/api/business/:id/trend` | `clinic_score_history`'den zaman serisi. |
| GET | `/api/business/:id/competitors` | Seçilen rakiplerin özet kartları (puan, yorum sayısı, güçlü/zayıf temalar). |

## Webhook'lar
- `POST /api/webhooks/apify` — Apify actor run tamamlandığında tetiklenir, ilgili run_id'ye bağlı analiz job'ını başlatır.
- `POST /api/webhooks/billing` — LemonSqueezy'den plan değişikliği bildirimleri (`subscription_created`, `subscription_updated`, `subscription_cancelled` vb.), `X-Signature` HMAC doğrulaması ile.

## Zamanlanmış işler (cron)
- `weekly-analysis-refresh` — Pro plan kullanıcıları için haftalık yeniden analiz tetikler.
- `monthly-analysis-refresh` — Free plan kullanıcıları için aylık.
- `task-priority-recalc` — `02-business-rules.md` Bölüm E'deki 14/60 günlük kuralları uygular.
