# 04 — API Tasarımı

Next.js API routes (veya ayrı Node servisi) üzerinden REST. Tüm endpoint'ler auth (Supabase session) gerektirir, `/api/public/*` hariç.

## Onboarding

| Method | Path | Açıklama |
|---|---|---|
| POST | `/api/business` | Google Place ID ile kullanıcının kendi işletmesini bağlar. Apify'dan temel veri çeker, `businesses` tablosuna yazar. |
| GET | `/api/business/:id/competitors/discover` | `region_category_cache`'i kontrol eder, gerekirse Apify Google Maps Scraper'ı tetikler (bkz. `05-ai-pipeline.md`), 10 aday döner (`02-business-rules.md` Bölüm B kurallarına göre). |
| POST | `/api/business/:id/competitors` | Kullanıcının checkbox ile seçtiği rakip listesini kaydeder (`competitors` tablosuna yazar). Min 3, max 10 validasyonu (Bölüm A). |
| POST | `/api/business/:id/analysis/run` | Seçilen rakipler + kendi işletme için yorum çekme + analiz pipeline'ını tetikler. **Faz 1'de senkron çalışır** (tek batch Apify çağrısı, route yanıtı işlem bitince döner) — job/queue altyapısı yok, mevcut tüm Apify çağrılarıyla aynı desen. Faz 1.1'in haftalık cron yenilemesi de bilinçli olarak aynı senkron batch desenle teslim edildi (bkz. aşağıda `weekly-analysis`) — async job + webhook altyapısı ancak senkron desen süre bütçesine sığmaz hale gelirse gündeme gelir. |

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
- `POST /api/webhooks/apify` — Apify actor run tamamlandığında tetiklenir, ilgili run_id'ye bağlı analiz job'ını başlatır. **Implemente edilmiyor** (bkz. yukarıdaki `analysis/run` notu) — Faz 1.1'in cron yenilemesi bilinçli olarak senkron batch teslim edildiği için bu webhook'a hâlâ ihtiyaç doğmadı; ancak senkron desen süre bütçesine sığmazsa değerlendirilir.
- `POST /api/webhooks/billing` — LemonSqueezy'den plan değişikliği bildirimleri (`subscription_created`, `subscription_updated`, `subscription_cancelled` vb.), `X-Signature` HMAC doğrulaması ile.

## Zamanlanmış işler (cron)

### `GET /api/cron/weekly-analysis` — Pro plan haftalık yeniden analiz (Faz 1.1)
- **Auth:** `Authorization: Bearer ${CRON_SECRET}` — Vercel Cron tarafından çağrılır. Secret eşleşmezse 401; `CRON_SECRET` tanımsızsa 500 (fail-closed). AI sağlayıcı yapılandırılmamışsa 502.
- **Kadans:** Vercel Cron **günlük** tetikler (`0 3 * * *`, `vercel.json`); haftalık ritim işletme başına cooldown penceresiyle sağlanır — yalnızca `last_scraped_at < now − PRO_PLAN_ANALYSIS_COOLDOWN_DAYS` olan işletmeler uygundur, günlük tik kalanları kendiliğinden toplar.
- **Uygunluk:** aktif Pro abonelik (`plan='pro' AND status='active'`) + enrichment tamam (`google_place_id`, `lat` dolu) + `last_scraped_at` dolu. İlk analiz bilinçli olarak manuel kalır — cron yalnızca daha önce analiz edilmiş işletmeleri yeniler.
- **Davranış:** uygun işletmeler `last_scraped_at` en eski önce senkron batch olarak sırayla işlenir; her işletme kendi try/catch'inde, bütçe kapısı (`TIME_BUDGET_MS`) aşılınca döngü kesilir — kalanlar yarınki tike kalır (bu doğal fren yeterli görüldüğünden ayrı bir `CRON_MAX_BUSINESSES_PER_RUN` sınırı şimdilik eklenmedi). Rakip sayısı < 3 olan işletme `failed/insufficient_competitors` olarak loglanıp atlanır. Görev üretimi manuel akışla aynı `MAX_NEW_TASKS_PER_CYCLE` sınırına tabidir.
- **Yanıt:** yalnız sayaçlar — `{ eligible, processed, succeeded, partial, failed, skipped }`.
- **Gözlemlenebilirlik:** her işletme koşusu `analysis_runs` tablosuna satır yazar (`trigger='cron'`, terminal status, hata detayı) — manuel tetikleme de aynı tabloya `manual` olarak loglanır (bkz. `03-database.md`).

Henüz implemente edilmeyen diğer işler:
- `monthly-analysis-refresh` — Free plan kullanıcıları için aylık.
- `task-priority-recalc` — `02-business-rules.md` Bölüm E'deki 14/60 günlük kuralları uygular.
