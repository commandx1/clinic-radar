# 10 — Roadmap & Başarı Metrikleri

> Riskler, kill-risk erken sinyalleri ve "haftalık görev" varsayımının test planı için: `11-risks-assumptions.md`. Oradaki Bölüm E aksiyon listesi bu roadmap'in üstünde önceliklidir — ürünü öldürebilecek varsayımlar doğrulanmadan feature sırası tartışılmaz.

## Faz 1 — MVP (4-6 hafta hedef)
- [x] Kayıt/giriş, işletme bağlama
- [x] Otomatik rakip keşfi (`02-business-rules.md` Bölüm B kuralları)
- [x] Checkbox ile rakip seçimi
- [x] Yorum çekme (Apify) — own + seçilen rakipler
- [x] Aşama 1 + Aşama 2 AI pipeline (`05-ai-pipeline.md`)
- [x] Görev listesi + Opportunity Score (`09-task-engine.md`)
- [x] Dashboard: Overview (executive kart), Tasks, Competitors, Reviews, Themes, Trend (`08-dashboard.md`)
- [x] Arayüz i18n — cihaz diline göre otomatik dil seçimi (tr/en, `07-ui.md`)
- [x] Free plan (limitler `02-business-rules.md` Bölüm A)

**Kapsam dışı (bilinçli):** otomatik yorum isteme/SMS, çok dilli **yorum** analizi (yabancı dildeki yorumların çevirisi/analizi), doktor/tedavi kırılımı, ajans paneli.

## Faz 1.1
- [x] Haftalık otomatik yeniden analiz (Pro plan) — Vercel Cron günlük tetikler (`0 3 * * *`, `vercel.json`), haftalık kadans işletme başına cooldown ile sağlanır (`/api/cron/weekly-analysis`, `CRON_SECRET` korumalı, bkz. `04-api.md`). E-posta özeti bu maddenin kapsamı dışında — aşağıdaki ayrı madde.
- [x] E-posta özet bildirimi — **not:** sadece bildirim değil, potansiyel ana teslimat kanalı; ağırlığı concierge test sonucuna göre belirlenir (`11-risks-assumptions.md` Bölüm D). Altyapı: `sendWeeklyDigests` haftalık toplu, idempotent (`emailed_at`) gönderim yapıyor; `theme_spike` kritik sinyali anlık gönderiyor (bkz. `src/lib/notifications/`).
- [x] Executive Summary (Aşama 3, `05-ai-pipeline.md`) — dashboard Overview'de iki dilli ({tr,en}) özet kartı; `clinic_score_history.executive_summary`'ye yazılır, tema trendleri (`theme_summary.trend`) artık kod tarafında hesaplanıyor
- [x] Task history görünümü (şema zaten hazır, sadece UI) — `/business/tasks/history`, Tasks sayfasıyla karşılıklı linkli alt-görünüm
- [x] Bildirim kuralları (`02-business-rules.md` Bölüm G) — üç kural da implemente edildi: yeni görev → haftalık özete dahil (`competitor_review_delta`), 60 günde auto-dismiss → haftalık özete dahil (`task_auto_dismissed`), kritik sinyal (3x mention artışı, Pro) → anlık e-posta (`theme_spike`). Ayrıca backlog drip ihtiyacı mevcut `MAX_NEW_TASKS_PER_CYCLE` sınırıyla karşılanıyor (bkz. `11-risks-assumptions.md`).
- [x] Döngüler arası "sessizlik" hissini azaltacak dashboard göstergeleri — az sayıda görev (Bölüm D eşikleri) + Free planda ayda 1 döngü (Bölüm A) birleşince kullanıcı analizler arası uygulamayı "çalışmıyor" sanabilir. İlk adım: Overview'de bir sonraki analizin ne zaman açılacağını proaktif göster (hata bekletmeden, cooldown süresince her ziyarette görünür).
- [x] `dismissed` görevlerin 2x mention patlamasında otomatik yeniden `open` olması (Bölüm E, `09-task-engine.md`) — kod tarafında implemente edildi. Sonraki adım (henüz yapılmadı): haftalık özet e-postası (yukarıdaki madde) üzerinden bu sinyalin kullanıcıya taşınması.

## Faz 1.2 — Görev kalitesi (kanıt → içgörü → iş)
- [x] Görev kartında kanıt satırı — own vs rakip mention kıyası, `theme_summary`'den kod tarafında hesaplanır, AI'a güvenilmez. Tema eşleşmezse satır gizlenir.
- [x] Görev başlığı kuralı — soyut hedef değil doğal eylem cümlesi; sağlık reklam mevzuatına aykırı öneri üretilmez (before/after fotoğraf, teşvikli yorum vb.) — prompt kuralı, `06-prompts.md`.
- [x] Checklist alt adımlar + tamamlanma kriterleri — `tasks.checklist_i18n jsonb` (migration `20260708000000_tasks_checklist_i18n.sql`), Aşama 2 çıktısına 3-5 somut bilingual alt adım (`gap-analysis-schema.ts`), UI'da tiklenebilir (`TaskCardBody`, `PATCH /api/tasks/[id]` checklistIndex/done); north star'ı (tamamlanan görev) doğrudan besler.
- [x] Impact score'un kod tarafında bileşenlerden hesaplanması — rakip yaygınlığı + trend + own eksikliği kırılımı; skor AI'dan alınmaz (`src/lib/task-engine/impact-score.ts`, `execute-analysis.ts` → `attachImpactScores`), karta "neden bu skor" kırılımı gösterilir (`TaskCardBody` → `ImpactScoreBreakdownLine`), `09-task-engine.md` senkron güncellendi.
- [x] Rakip bazlı tema saklama — `theme_summary`'de rakip bazında satırlar (`competitor_id` dolu) zaten mevcuttu; kod tarafında bu satırlardan tema başına "N rakibinden M'i güçlü" kırılımı türetilip (`resolve-tasks-shared.ts` → `ThemeCompetitorBreakdownLookup`) görev kartındaki kanıt satırına eklendi. Ham yorum alıntısı yasağı geçerli kalır; skorlamayı etkilemez.

Not: tahmini etki gösterimi bantlı olacak (`potential-rating-gain` düşük/orta/yüksek), asla "+0.18 yıldız" gibi kesin tahmin verilmez — uydurulmuş hassasiyet güveni yıkar.

**Yeniden doğrulama (2026-07-06):** Faz 1.2 tamamlandı olarak işaretlenmişti; bu tarihte `tsc --noEmit`, `npm run lint`, `npm run build` ve `supabase migration list --local` (23 migration, hepsi local=remote) yeniden çalıştırıldı — hepsi temiz. Kod tabanında `TODO`/`FIXME` taraması yapıldı, tek sonuç `weekly-digest.ts`'teki bilinen locale kısıtıydı (zaten `11-risks-assumptions.md` Risk 1'de belgeli). Faz 1.2 kapsamında yeni bir açık/eksik bulunmadı; aşağıdaki iki kalibrasyon maddesi (gerçek veri bekliyor) dışında kapanış geçerli.

### Faz 1.2 — Bilinen kısıtlar (ignore edilmedi, sıradaki iterasyonda bakılacak)
- [x] **Checklist tamamlama → görev durumu senkron.** `handleChecklistUpdate` (`src/app/api/tasks/[id]/route.ts`) artık tüm alt adımlar `done` olduğunda `tasks.status`'u otomatik `"done"` yapıyor ve `completed_at` set ediyor; kullanıcı bir adımı geri açıp görev sadece bu otomasyonla "done" olduysa (dismissed asla otomatik dokunulmaz) görev tekrar "open"a dönüyor. North star metriği artık checklist ile senkron.
- [ ] **Clinic Score formülü kalibre edilmedi.** `src/lib/task-engine/clinic-score.ts` başında not var: "v1 tahmini, kalibre edilecek". Ağırlıklar (0.4 rating / 0.3 completion / 0.3 growth) keyfi sabit, gerçek kullanıcı verisiyle doğrulanmadı. **Kod tarafında düzeltilecek bir hata değil** — ilk 20-30 gerçek işletme verisi toplanmadan kalibre edilemez; Faz 2 girişinde ele alınacak.
- [ ] **Impact score eşikleri de tahmini.** `constants.ts` içindeki `TASK_MENTION_THRESHOLD`, `THEME_TREND_MIN_MENTIONS`, `TASK_PRIORITY_HIGH_THRESHOLD`/`TASK_PRIORITY_MEDIUM_THRESHOLD`, `IMPACT_SCORE_*_WEIGHT` sabitleri ilk 20-30 gerçek görev üzerinde kalibre edilmeyi bekliyor; şu an `PRIORITY_ORDER` sıralaması ilk kullanıcılarda yanlış hizalanabilir. Aynı şekilde gerçek veri bekleyen kalibrasyon işi — Faz 2'de ele alınacak.
- [x] **Checklist backfill.** Migration öncesi oluşturulmuş, `checklist_i18n` boş/null olan açık (`status = "open"`) görevler için tek seferlik backfill script'i eklendi (`scripts/backfill-task-checklists.ts`) — mevcut görev verisinden (title/theme/description) AI pipeline'daki checklist şemasıyla aynı formatta 3-5 adım üretip yazıyor. `npm run backfill:checklists` ile çalıştırılır, `--dry-run` destekler.
- [x] **Rakip bazlı tema kırılımı sessizce kaybolmuyor, bilinçli bir fallback.** İnceleme sonucu: `TaskEvidenceLine` (`task-evidence-line.tsx`) zaten `hasBreakdown` kontrolüyle çalışıyor — rakip kırılımı (`competitorStrongCount`/`competitorTotalCount`) yoksa sadece o ek cümleyi atlıyor, own vs rakip pozitif mention karşılaştırması (`competitiveGap` metni) her zaman gösteriliyor. Yani kanıt satırı hiçbir zaman tamamen kaybolmuyor; sadece rakip scrape'i olmayan işletmelerde kırılım detayı eklenmiyor. Bu, bug değil kasıtlı graceful-degradation davranışıydı — yorum satırına netleştirme eklendi, ayrı bir kod değişikliği gerekmedi.

### Faz 1.2 kapanışında bulunup düzeltilen sorunlar
Faz 1.2'nin "tamamlandı" işaretlenmiş kod değişiklikleri diskte duruyordu ama commit edilmemişti ve iki gerçek üretim-öncesi hata içeriyordu; kapanış doğrulamasında (typecheck + lint + build + migration + gerçek DB sorgusu) bulunup düzeltildi:
- **3 migration hiç uygulanmamıştı** (`20260708000000_tasks_checklist_i18n`, `20260709000000_tasks_impact_score_breakdown`, `20260710000000_theme_summary_competitor_id`) — kod bu kolonları varsayıyordu ama yerel DB'de yoktu (`supabase migration up` ile uygulandı, veri kaybı yok).
- **`service_role` hiçbir tabloda SELECT/INSERT/UPDATE/DELETE GRANT'ına sahip değildi** — `rolbypassrls=true` sadece RLS'i atlar, GRANT'ı atlamaz. `/api/cron/weekly-analysis` (tüm haftalık analiz + bildirim döngüsü) bu yüzden "permission denied" ile tamamen çalışmıyordu; `20260711000000_service_role_grants.sql` ile düzeltildi (detay: `03-database.md`).
- `scripts/backfill-task-checklists.ts` lint hataları (import sırası, `console.log` yasak, template literal tip hataları, `.env.local` yüklenmiyordu, catch değişkeni tipsizdi) — script çalışır hale getirildi ve doğrulandı (`--dry-run` gerçek yerel DB'ye karşı test edildi).

## Faz 2
- [x] **Monthly Report (PDF export)** — Overview'de "Aylık raporu indir (PDF)" aksiyonu, `GET /api/business/:id/monthly-report` (bkz. `04-api.md`, `08-dashboard.md`).
- [x] **Monthly Report e-posta kanalı** — aynı rapor işletme başına ~30 günde bir otomatik e-posta + PDF ek olarak da gönderiliyor (`sendMonthlyReportEmails`, `src/lib/notifications/monthly-report-digest.ts`), `weekly-analysis` cron'unun günlük `runDailyMaintenance` adımına eklendi — yeni bir cron path'i gerekmedi. İdempotency `businesses.monthly_report_emailed_at` ile (migration `20260713000000_businesses_monthly_report_emailed_at.sql`). Maliyet: yalnızca DB sorguları + PDF render, AI çağrısı yok — bu yüzden mevcut günlük cron'a eklenmesi kadans/maliyet açısından güvenli bulundu.
- [x] **Treatments sekmesi** — `/business/treatments`, Aşama 1'e eklenen opsiyonel `treatment` alanına göre own vs rakip (birleşik) toplulaştırma (bkz. `05-ai-pipeline.md`, `08-dashboard.md`, migration `20260712000000_theme_summary_treatment.sql`). Gerçek oturumla (sahte session cookie'siyle authenticated SSR isteği) uçtan uca doğrulandı.
- Karışık dilli yorum kırılımı — turistik/uluslararası hasta çeken klinikler için yorumları dil/köken bazında ayrıştırma (herhangi bir ülkede uygulanabilir, tek bir ülkeye özel bir senaryo değil)
- Ajans / white-label paneli (çoklu işletme yönetimi)
- Doctor Analysis sekmesi (`08-dashboard.md`)
- Akıllı rakip önerisi (fiyat segmenti, tedavi türü benzerliği — şu an kullanıcı checkbox ile seçtiği için ertelendi)

### Faz 2 kapanışında bulunup düzeltilen sorunlar
- **Themes sayfası bug'ı:** `theme_summary` sorgusu `competitor_id IS NULL` filtrelemiyordu; Faz 1.2'nin rakip bazlı kırılım satırları devreye girdiğinde `buildThemeRows`'un `existing.competitor = cell` ataması (toplama değil) sorgu sırasına göre rastgele TEK bir rakibin sayısını "Competitors (combined)" diye gösterecekti — Treatments sayfası yazılırken theme_summary'nin tüm okuyucuları taranırken fark edildi, filtre eklendi, gerçek oturumla yeniden doğrulandı (bkz. `08-dashboard.md`).

### Faz 2 — Bilinen kısıtlar (ignore edilmedi, sıradaki iterasyonda bakılacak)
- [ ] **Monthly Report "dönem" tanımı sabit değil.** Kadans adaptif/haftalık olduğu için tam 30 gün öncesine denk gelen bir `clinic_score_history` snapshot'ı nadiren var; en yakın önceki snapshot'a düşülüyor, hiç yoksa Clinic Score deltası gösterilmiyor (bug değil, veri kısıtı — bkz. `monthly-report-data.ts` yorumu). Free planda (aylık kadans) bu durum Pro'ya göre daha sık yaşanır.
- [ ] **Treatments, mevcut analiz verisi üretilene kadar boş görünür.** `treatment` alanı yalnızca YENİ bir analiz koşusundan sonra dolar (Aşama 1 prompt değişikliği geriye dönük eski `theme_summary` satırlarını güncellemez) — checklist backfill'e benzer bir tek seferlik backfill script'i şimdilik yazılmadı, çünkü treatment ataması AI'ın ham yorum metnine bakmasını gerektiriyor (ham yorum metni zaten saklanıyor, `reviews.text`) ve maliyeti var; ilk gerçek kullanıcı geri bildirimine göre değerlendirilecek.
- [ ] **Kalan 4 Faz 2 maddesi henüz başlanmadı — her birinde kod yazmadan önce netleştirilmesi gereken somut bir engel var, tahminle ilerlenmedi:**
  - **Doctor Analysis** — yorumlardan gerçek kişi (doktor/personel) ismi çıkarıp isim bazlı sentiment saklamak, `08-dashboard.md`'de zaten "gizlilik riski" olarak işaretlenmişti. Netleştirilmesi gereken: bu, işletmenin kendi çalışanı hakkında rızası olmadan kişisel veri işlemek anlamına gelebilir (KVKK/GDPR açısından) — ürün/hukuki bir karar olmadan implemente edilmemeli.
  - **Akıllı rakip önerisi** — "fiyat segmenti" sinyali şu an hiçbir veri kaynağında yok: `src/lib/apify/google-places.ts`'in eşlediği alanlar (`placeId, title, totalScore, reviewsCount, categoryName, location`) fiyat içermiyor; Apify aktörünün (`compass/crawler-google-places`) gerçekten bir price/priceRange alanı dönüp dönmediği doğrulanmadı — doğrulamak gerçek bir Apify çağrısı (ücretli) gerektiriyor, onaysız harcama yapılmadı. "Tedavi türü benzerliği" ise adayların henüz yorumu çekilmemiş olması nedeniyle (rakip seçilene kadar yorum scrape edilmiyor, `02-business-rules.md` Bölüm B) mevcut akışta imkânsız — ya seçim öncesi küçük bir örnek yorum çekilmeli (maliyet artışı, mevcut tasarım ilkesine aykırı) ya da bu özellik ertelenmeli.
  - **Karışık dilli yorum kırılımı** — göründüğünden daha büyük: `reviews.original_language` zaten dolduruluyor ve `translated_text` kolonu zaten var, ama CLAUDE.md'nin sabit kuralı ("Ham yorum metni `reviews.text` asla UI'da birebir gösterilmez — sadece Claude'un paraphrase edilmiş özeti gösterilir, telif/güvenlik nedeniyle") ham çeviri göstermeyi de kapsıyor olabilir (bir çeviri de "birebir" metnin bir türevi) — bu yüzden muhtemelen literal çeviri değil, yorum-bazlı bir AI parafrazı gerekiyor; bu da henüz yazılmamış "yorum bazlı analiz" (`review_analysis` tablosu, Aşama 1 şema genişletmesi, ayrı bir yerde zaten "ertelenen" olarak işaretli, bkz. `05-ai-pipeline.md`) altyapısını önkoşul olarak gerektiriyor.
  - **Ajans/white-label paneli** — çoklu işletme yönetimi mevcut `businesses.user_id` 1:1 modelini değiştiriyor (bkz. `03-database.md`), RLS politikaları ve billing modelini (LemonSqueezy plan yapısı) etkileyen geri dönüşü zor bir mimari karar.

## Launch Hazırlığı (2026-07)
- [x] Test altyapısı — Vitest kuruldu (config + `npm` script'leri, husky pre-push hook'u ile push öncesi otomatik koşum).
- [x] Task-engine birim testleri — impact score kırılımı, `potential-rating-gain`, dismissed-reopen mantığı dahil çekirdek skorlama fonksiyonları test altına alındı.
- [x] `task-candidates` ayrıştırması — aday üretim/skorlama mantığı `execute-analysis.ts` içinden `src/lib/analysis/task-candidates.ts`'e taşındı, kendi test dosyasıyla (`task-candidates.test.ts`) birlikte.
- [x] Billing birim testleri — `handle-webhook-event` (event eşleme, `custom_data.user_id`/`lemonsqueezy_subscription_id` fallback) ve `verify-webhook-signature` (geçerli/geçersiz/eksik imza) kapsandı.
- [x] Weekly digest locale düzeltmesi — e-posta dili artık `users.preferred_locale`'den okunuyor (`POST /api/locale` ile kullanıcı tercihi saklanır); Faz 1.2 yeniden doğrulamasında not edilen bilinen locale kısıtı kapandı (`11-risks-assumptions.md` Risk 1).
- [x] Launch dokümanları — `billing-verification-runbook.md` (LemonSqueezy uçtan uca doğrulama: checkout → webhook imza → iptal/expire → canlıya geçiş) ve `launch-checklist.md` (Supabase prod, env değişkenleri, Vercel cron, üçüncü parti servisler, smoke test, izleme/rollback).
- Doğrulama: `tsc --noEmit` + eslint temiz, 70/70 test geçiyor (9 test dosyası).

## Faz 3
- AI arama görünürlüğü modülü (ChatGPT/Gemini/Perplexity'de klinik nasıl öneriliyor)
- Tema taksonomisi ölçeklenirse embedding/clustering katmanı (`05-ai-pipeline.md`'deki gerekçeye bkz.)

## Başarı metrikleri

**Kuzey yıldızı:** haftalık tamamlanan görev sayısı / kullanıcı (`01-product-vision.md`).

| Metrik | Neden önemli |
|---|---|
| Onboarding tamamlama oranı (kayıt → ilk görev listesi) | Aktivasyon darboğazını gösterir |
| Haftalık aktif kullanıcı / görev tamamlama oranı | Asıl retention sinyali |
| Free → Pro dönüşüm oranı | Monetizasyon sağlığı |
| Ortalama görev tamamlama süresi | Kullanıcı gerçekten aksiyon alıyor mu |
| Clinic Score trendi (kullanıcı bazında, zaman içinde) | Ürünün gerçekten sonuç üretip üretmediği — uzun vadeli en kritik metrik |
