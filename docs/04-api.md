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
| GET | `/api/business/:id/treatments` | Faz 2 — `theme_summary.treatment` alanına göre kendi vs rakip (birleşik) kırılımı, tema yerine tedavi/hizmet türü bazında toplulaştırılmış. `themes` ile aynı şekilde ayrı bir REST route değil, `/business/treatments` sayfası SSR sırasında doğrudan sorgular (bkz. `08-dashboard.md`). |
| GET | `/api/business/:id/trend` | `clinic_score_history`'den zaman serisi. |
| GET | `/api/business/:id/competitors` | Seçilen rakiplerin özet kartları (puan, yorum sayısı, güçlü/zayıf temalar). |
| GET | `/api/business/:id/monthly-report` | Faz 2 — aylık özeti tek sayfalık PDF olarak döner (`application/pdf`, `Content-Disposition: attachment`). Kullanıcı oturumuyla (RLS) çalışır; `business_id` kullanıcıya ait değilse 404. Detay: `08-dashboard.md`. Ayrıca aynı rapor işletme başına ~30 günde bir otomatik e-posta olarak da gönderilir — ayrı bir route değil, `weekly-analysis` cron'unun günlük tetiklemesi içinde çalışır (bkz. aşağıda). |

## Billing

| Method | Path | Açıklama |
|---|---|---|
| GET | `/api/billing/checkout` | Kullanıcı oturumu gerektirir. LemonSqueezy'de `custom_data: { user_id }` ile bir checkout oluşturur (`src/lib/billing/lemonsqueezy-client.ts`) ve dönen hosted checkout URL'ine 307 redirect eder — client-side JS/SDK yok, düz `<a href>` navigasyonu yeterli. |
| POST | `/api/billing/cancel` | Kullanıcı oturumu gerektirir. Kullanıcının `subscriptions` satırındaki `lemonsqueezy_subscription_id` ile LemonSqueezy'de `DELETE /v1/subscriptions/:id` çağırır (dönem sonunda iptal planlar, o zamana kadar erişim devam eder). Aktif abonelik yoksa 404, zaten iptal edilmişse 409 döner. DB satırını kendisi güncellemez — durum senkronu her zaman olduğu gibi `subscription_cancelled`/`subscription_updated` webhook'u üzerinden gelir (bkz. aşağıda). Kullanıcı etkileşimiyle tetiklenen bir yazma işlemi olduğu için CLAUDE.md kuralına göre TanStack Query mutation ile çağrılır (`business/billing/use-cancel-subscription.ts`). |

## Webhook'lar
- `POST /api/webhooks/apify` — Apify actor run tamamlandığında tetiklenir, ilgili run_id'ye bağlı analiz job'ını başlatır. **Implemente edilmiyor** (bkz. yukarıdaki `analysis/run` notu) — Faz 1.1'in cron yenilemesi bilinçli olarak senkron batch teslim edildiği için bu webhook'a hâlâ ihtiyaç doğmadı; ancak senkron desen süre bütçesine sığmazsa değerlendirilir.
- `POST /api/webhooks/billing` — **Implemente edildi** (`src/app/api/webhooks/billing/route.ts`). LemonSqueezy'den plan değişikliği bildirimleri (`subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_resumed`, `subscription_expired`, `subscription_paused`, `subscription_unpaused`), `X-Signature` HMAC-SHA256 doğrulaması ile (`src/lib/billing/verify-webhook-signature.ts`, ham body üzerinde timing-safe karşılaştırma). Kullanıcı oturumu olmadan çağrıldığı için `createAdminClient()` kullanır — bkz. `CLAUDE.md` admin client istisnası. `meta.custom_data.user_id` (checkout'ta set edilir) ile satır eşleştirilir, yoksa `lemonsqueezy_subscription_id` fallback olarak kullanılır (`src/lib/billing/handle-webhook-event.ts`). **`subscription_payment_success`/`subscription_payment_failed` kasıtlı olarak işlenmez** — bu event'lerde `data` bir subscription değil, farklı alan şemasına sahip bir subscription-invoice'tur; subscription durumu zaten `subscription_updated` ile senkron tutulur.

## Zamanlanmış işler (cron)

### `GET /api/cron/weekly-analysis` — Pro plan haftalık yeniden analiz (Faz 1.1)
- **Auth:** `Authorization: Bearer ${CRON_SECRET}` — Vercel Cron tarafından çağrılır. Secret eşleşmezse 401; `CRON_SECRET` tanımsızsa 500 (fail-closed). AI sağlayıcı yapılandırılmamışsa 502.
- **Kadans:** Vercel Cron **günlük** tetikler (`0 3 * * *`, `vercel.json`); haftalık ritim işletme başına cooldown penceresiyle sağlanır — yalnızca `last_scraped_at < now − PRO_PLAN_ANALYSIS_COOLDOWN_DAYS` olan işletmeler uygundur, günlük tik kalanları kendiliğinden toplar.
- **Uygunluk:** aktif Pro abonelik (`plan='pro' AND status='active'`) + enrichment tamam (`google_place_id`, `lat` dolu) + `last_scraped_at` dolu. İlk analiz bilinçli olarak manuel kalır — cron yalnızca daha önce analiz edilmiş işletmeleri yeniler.
- **Davranış:** uygun işletmeler `last_scraped_at` en eski önce senkron batch olarak sırayla işlenir; her işletme kendi try/catch'inde, bütçe kapısı (`TIME_BUDGET_MS`) aşılınca döngü kesilir — kalanlar yarınki tike kalır (bu doğal fren yeterli görüldüğünden ayrı bir `CRON_MAX_BUSINESSES_PER_RUN` sınırı şimdilik eklenmedi). Rakip sayısı < 3 olan işletme `failed/insufficient_competitors` olarak loglanıp atlanır. Görev üretimi manuel akışla aynı `MAX_NEW_TASKS_PER_CYCLE` sınırına tabidir.
- **Yanıt:** yalnız sayaçlar — `{ eligible, processed, succeeded, partial, failed, skipped }`.
- **Gözlemlenebilirlik:** her işletme koşusu `analysis_runs` tablosuna satır yazar (`trigger='cron'`, terminal status, hata detayı) — manuel tetikleme de aynı tabloya `manual` olarak loglanır (bkz. `03-database.md`).
- **Günlük bakım (plan bağımsız):** aynı tetiklemede `runDailyMaintenance` de çalışır — 60 günlük auto-dismiss taraması, haftalık özet e-postası (`sendWeeklyDigests`) ve Monthly Report e-postası (`sendMonthlyReportEmails`, 02-business-rules.md Bölüm G). Yanıta `maintenance: { autoDismissed, digestSent, digestSkipped, monthlyReportSent, monthlyReportSkipped }` olarak eklenir.

Henüz implemente edilmeyen diğer işler:
- `monthly-analysis-refresh` — Free plan kullanıcıları için aylık.
- `task-priority-recalc` — `02-business-rules.md` Bölüm E'deki 14/60 günlük kuralları uygular.
