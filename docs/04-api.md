# 04 — API Tasarımı

Next.js API routes (veya ayrı Node servisi) üzerinden REST. Tüm endpoint'ler auth (Supabase session) gerektirir, `/api/public/*` hariç.

## Onboarding

| Method | Path | Açıklama |
|---|---|---|
| POST | `/api/business` | Google Place ID ile kullanıcının kendi işletmesini bağlar. Apify'dan temel veri çeker, `businesses` tablosuna yazar. |
| GET | `/api/business/:id/competitors/discover` | `region_category_cache`'i kontrol eder, gerekirse Apify Google Maps Scraper'ı tetikler (bkz. `05-ai-pipeline.md`), 10 aday döner (`02-business-rules.md` Bölüm B kurallarına göre). |
| POST | `/api/business/:id/competitors` | Kullanıcının checkbox ile seçtiği rakip listesini kaydeder (`competitors` tablosuna yazar). Min 3, max 10 validasyonu (Bölüm A). |
| POST | `/api/business/:id/analysis/run` | Seçilen rakipler + kendi işletme için yorum çekme + analiz pipeline'ını tetikler. **Faz 1'de senkron çalışır** (tek batch Apify çağrısı, route yanıtı işlem bitince döner) — job/queue altyapısı yok, mevcut tüm Apify çağrılarıyla aynı desen. Async job + webhook akışı, bekleyen bir HTTP isteği olmadan tetiklenmesi gereken Faz 1.1'in haftalık/aylık cron yenilemesiyle birlikte devreye alınacak. |

## Görevler

| Method | Path | Açıklama |
|---|---|---|
| GET | `/api/business/:id/tasks` | Görev listesini `status`, `priority` filtreleriyle döner. **Faz 1'de ayrı bir REST endpoint olarak inşa edilmedi** — `/business` sayfası bunu SSR sırasında doğrudan Supabase sorgusuyla okuyor (CLAUDE.md "SSR öncelikli" kuralı, `business/page.tsx`'teki mevcut desenle tutarlı). Filtre/liste ihtiyacı duyan ayrı bir API tüketicisi (ör. tam Dashboard'un Tasks sekmesi) ortaya çıktığında eklenir. |
| PATCH | `/api/tasks/:id` | Durum güncelleme (`open` → `done` / `dismissed`). Gerçekten implemente edildi — kullanıcı etkileşimiyle tetiklenen bir yazma işlemi olduğu için CLAUDE.md kuralına göre gerçek bir endpoint + TanStack Query mutation. |
| GET | `/api/business/:id/tasks/history` | Tamamlanan/reddedilen görevlerin geçmişi (Faz 1.1). |

## Dashboard

| Method | Path | Açıklama |
|---|---|---|
| GET | `/api/business/:id/overview` | Executive özet: Clinic Score, Competitor Rank, Critical Issues sayısı, tamamlanan görev oranı, Potential Rating Gain (bkz. `08-dashboard.md`). |
| GET | `/api/business/:id/themes` | `theme_summary` tablosundan kendi vs rakip kırılımı. |
| GET | `/api/business/:id/trend` | `clinic_score_history`'den zaman serisi. |
| GET | `/api/business/:id/competitors` | Seçilen rakiplerin özet kartları (puan, yorum sayısı, güçlü/zayıf temalar). |

## Webhook'lar
- `POST /api/webhooks/apify` — Apify actor run tamamlandığında tetiklenir, ilgili run_id'ye bağlı analiz job'ını başlatır. **Faz 1'de implemente edilmiyor** (bkz. yukarıdaki `analysis/run` notu) — Faz 1.1'de async cron yenilemesiyle birlikte eklenecek.
- `POST /api/webhooks/billing` — LemonSqueezy'den plan değişikliği bildirimleri (`subscription_created`, `subscription_updated`, `subscription_cancelled` vb.), `X-Signature` HMAC doğrulaması ile.

## Zamanlanmış işler (cron)
- `weekly-analysis-refresh` — Pro plan kullanıcıları için haftalık yeniden analiz tetikler.
- `monthly-analysis-refresh` — Free plan kullanıcıları için aylık.
- `task-priority-recalc` — `02-business-rules.md` Bölüm E'deki 14/60 günlük kuralları uygular.
