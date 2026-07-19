# Launch Checklist

> Prod'a ilk çıkış öncesi tek seferlik doğrulama listesi. Billing'in ayrıntılı uçtan uca doğrulaması için: `billing-verification-runbook.md`. Sıralama önemlidir — her bölüm bir öncekinin tamamlanmış olmasına dayanır.

## 1. Supabase (Prod Projesi)

- [ ] Prod Supabase projesi oluşturuldu (dev projesinden ayrı).
- [ ] Tüm migration'lar uygulandı: `supabase db push` (veya migration dosyaları sırayla SQL editor'den). `supabase/migrations/` ile prod şemasının eşleştiğini `supabase db diff` ile doğrula — çıktı boş olmalı.
- [ ] RLS: tüm tablolarda aktif; anon key ile başka kullanıcının verisi okunamadığı spot-check edildi (`03-database.md`).
- [ ] Auth ayarları: e-posta doğrulama açık, Site URL ve Redirect URL'ler prod domain'e set edildi.
- [ ] `database.types.ts` prod şemasından güncel: `supabase gen types typescript` çıktısı ile repo'daki dosya diff'siz.

## 2. Env Değişkenleri (Vercel → Production)

| Grup | Değişkenler |
|---|---|
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| AI | `AI_PROVIDER` (`gemini` \| `anthropic`), sağlayıcıya göre `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` |
| Scraping | `APIFY_TOKEN`, opsiyonel `APIFY_PRICE_PER_REVIEW_USD`, `CRON_APIFY_TIMEOUT_MS` |
| Google | `GOOGLE_MAPS_API_KEY` (Places API kısıtlı key — sadece gerekli API'ler ve HTTP referrer/IP kısıtı) |
| Billing | `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_PRO_VARIANT_ID`, `LEMONSQUEEZY_WEBHOOK_SECRET` (**live** değerler — test mode değil) |
| E-posta | `RESEND_API_KEY`, `RESEND_FROM_EMAIL` |
| Cron | `CRON_SECRET` (güçlü rastgele değer), opsiyonel `CRON_SELF_BASE_URL` (yoksa `VERCEL_PROJECT_PRODUCTION_URL` kullanılır) |

- [ ] Hepsi Production scope'unda set edildi; service role key ve secret'lar `NEXT_PUBLIC_` prefix'i **taşımıyor**.
- [ ] Provider seçimine göre doğru AI key'i mevcut — `assertProviderConfigured` cron'da fail-fast eder.

## 3. Vercel Deploy

- [ ] `vercel.json` cron kaydı prod'da görünüyor: `/api/cron/weekly-analysis`, `0 3 * * *` (Vercel → Project → Crons).
- [ ] Production build temiz: `npx tsc --noEmit && npx eslint . && npx vitest run && next build` lokalde geçti; Vercel build log'unda warning taraması yapıldı.
- [ ] Custom domain bağlandı, HTTPS/redirect (www → apex veya tersi) tek kanonik host'a gidiyor.

## 4. Üçüncü Parti Servis Doğrulaması

- [ ] **Resend:** gönderici domain'i doğrulandı (SPF + DKIM), `RESEND_FROM_EMAIL` bu domain'de. Kendine test digest gönderimi yapıldı; spam'e düşmüyor.
- [ ] **Apify:** ücretli plan/limit kontrolü — haftalık döngüdeki tahmini yorum hacmi için kredi yeterli (`estimateScrapeCostUsd` çıktısını referans al).
- [ ] **Google Places:** billing aktif, kota ve günlük limit alarmı kuruldu.
- [ ] **LemonSqueezy:** `billing-verification-runbook.md` Bölüm 6 (canlıya geçiş) tamamlandı — gerçek kartla satın alma + iptal + refund döngüsü doğrulandı.

## 5. Uçtan Uca Smoke Test (Prod)

- [ ] Yeni kullanıcı kaydı → e-posta doğrulama → giriş.
- [ ] İşletme bağlama → rakip keşfi (min 3 / max 10 validasyonu) → ilk analiz döngüsü tamamlanıyor.
- [ ] Dashboard: Overview (executive summary + sonraki analiz zamanı), Tasks (checklist tik), Competitors, Reviews, Themes, Trend sayfaları yükleniyor.
- [ ] i18n: tarayıcı dili tr/en'e göre arayüz ve e-posta locale'i doğru (`/api/api/locale` değil — `POST /api/locale` ile manuel geçiş de çalışıyor).
- [ ] Cron manuel tetikleme: `curl -H "Authorization: Bearer $CRON_SECRET" https://<domain>/api/cron/weekly-analysis` → 200, log'larda döngü özeti.
- [ ] Free plan limiti: 2. analiz denemesi cooldown mesajı gösteriyor (ayda 1, `02-business-rules.md` Bölüm A).

## 6. İzleme & Operasyon

- [ ] Vercel log drain veya en azından cron invocation'ları için haftalık manuel log kontrolü rutini belirlendi.
- [ ] LemonSqueezy webhook delivery paneli ilk 24-48 saat izlenecek (non-2xx birikimi alarmı).
- [ ] Supabase: DB boyutu ve auth rate-limit panelleri gözden geçirildi; ücretsiz plan sınırlarına yaklaşma alarmı var.
- [ ] Rollback planı: son bilinen iyi deployment'a Vercel "Instant Rollback"; migration'lar geri alınamaz varsayılır — şema değişiklikleri additive tutulur.

## 7. Son Kontroller

- [ ] `docs/` güncel — özellikle `04-api.md` endpoint tablosu ve `10-roadmap.md` durum işaretleri gerçeği yansıtıyor.
- [ ] Repo'da secret sızıntısı taraması: `git log -p | grep -iE "api_key|secret"` spot-check temiz; `.env*` dosyaları `.gitignore`'da.
- [ ] Yasal: gizlilik politikası + kullanım şartları sayfaları yayında (LemonSqueezy checkout bunlara link ister).
