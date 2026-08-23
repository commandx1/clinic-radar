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

## Faz 2.1 — Çoklu yorum kaynağı (2026-07)

Google dışı yorum kaynaklarının araştırılması sonucu: **yalnızca Trustpilot** kabul edildi. Doktortakvimi ve
Şikayetvar elendi (hazır/güvenilir Apify aktörü yok, Şikayetvar'da yıldız puanı hiç yok — sentiment'i
sistematik olarak bozardı). Facebook bilinçli olarak ertelendi.

- [x] **Faz A — şema soyutlaması.** `reviews.place_id` → `source_ref`, `reviews.source` (+ check constraint),
  dedup index'i `(source, source_ref, review_id)`, adapter/registry katmanı (`src/lib/reviews/`).
  Kullanıcıya görünen değişiklik yok; Google akışı bit-birebir aynı kaldı.
- [x] **Faz B — Trustpilot entegrasyonu.** `sian.agency/trustpilot-reviews-scraper` aktörü, `website` alanından
  otomatik domain çözümlemesi (www'lu/www'suz iki varyant denenir, sonuç `trustpilot_domain` +
  `trustpilot_checked_at` ile cache'lenir), Pro/Agency planına özel. Yorumlar Google ile **tek analiz
  havuzunda** birleşir — kaynak bazlı ağırlıklandırma yok.
- [x] **Faz B-3 — elle domain düzeltme.** Pro kullanıcı kendi işletmesinin Trustpilot domain'ini elle
  girebilir/düzeltebilir (`PATCH /api/business/:id` → `trustpilot_domain_override`); alanı boşaltmak
  "Trustpilot profilim yok" demektir, yeniden arama tetiklemez. Rakipler için elle düzeltme **yok**
  (yanlış domain, yabancı bir şirketin yorumlarını analize sokardı). Non-Pro kullanıcı alanı görür ama
  kilitlidir (Pro rozeti) — kilit UI-only değil, route da `403 pro_required` döner.
- [x] **Legal + UI kaynak senkronu.** Gizlilik ve Kullanım Şartları metinleri (tr/en) artık veri kapsamını
  "Google Maps + Trustpilot" olarak tanımlıyor (yürürlük tarihi 27 Temmuz 2026'ya çekildi). Reviews sayfası
  her yorumda kaynak rozeti gösteriyor ve dış link etiketi kaynağa göre üretiliyor (`viewOnSource`) —
  önceki sabit "Google'da görüntüle" etiketi Trustpilot yorumlarında yanlış olurdu.

Detay: `02-business-rules.md` Bölüm I, `03-database.md`, `04-api.md`.

### Faz 2.1 — Bilinen kısıtlar
- [ ] **Trustpilot yalnızca `website` dolu olan kayıtlarda çalışır.** `website` kolonları Trustpilot
  migration'ıyla eklendi; enrichment (`enrich-from-apify.ts`) yeni kayıtlarda dolduruyor, ama migration
  öncesinde oluşmuş işletme/rakip satırlarında null kalır ve kendiliğinden dolmaz (enrichment yalnızca
  `google_place_id` değişince yeniden koşar). Gerçek kullanıcı olmadığı için backfill yazılmadı.
- [ ] **Kapsam gerçekliği.** Trustpilot hacmi ağırlıklı olarak medikal turizm kliniklerinde; yerel
  (mahalle ölçeğinde) klinikler için çoğu zaman profil bulunmaz ve akış sessizce yalnızca Google ile
  devam eder. Bu beklenen davranış, hata değil.

## Faz 2.2 — Yorum yanıt asistanı (2026-08)
- [x] **Review Reply Assistant.** Kullanıcının kendi (`owner_type='own'`) yanıtlanmamış yorumları için AI'ın taslak bir sahibi yanıtı ürettiği özellik — Reviews sekmesinde her yanıtsız yorum kartında "Yanıt taslağı oluştur" aksiyonu, düzenlenebilir taslak, "Kopyala", kaynağa dış link ve "Yanıtladım" işareti (`POST /api/reviews/:id/reply-draft`, `PATCH /api/reviews/:id`, bkz. `04-api.md`, `02-business-rules.md` Bölüm J, `06-prompts.md`).
- [x] **Şema/prompt sağlayıcıdan bağımsız** (`src/lib/ai-pipeline/reply-draft-schema.ts`), Claude/Gemini implementasyonları executive-summary ile birebir aynı kontratı paylaşıyor (`src/lib/claude/reply-draft.ts`, `src/lib/gemini/reply-draft.ts`, `provider.ts`'e eklendi).
- [x] **Gizlilik kısıtları prompt'a gömülü:** taslak asla birebir alıntı yapmaz, hasta olup olmadığını doğrulamaz/reddetmez, teşhis/tedavi/tarih içermez, tıbbi tavsiye vermez, indirim/teşvik teklif etmez.
- [x] **Kota:** Free plan ayda **5** taslak (`FREE_PLAN_REPLY_DRAFTS_PER_MONTH`, 30 günlük hareketli pencere, saf fonksiyon `reply-draft-quota.ts` + birim test), Pro/Agency sınırsız.
- [x] **Şema:** `reviews.reply_draft`, `reply_draft_generated_at`, `reply_marked_at` (migration `20260823000000_reviews_reply_draft.sql`) — mevcut "reviews update own" RLS policy'si ve `authenticated`/`service_role` grant'ları (tablo bazlı) yeni kolonları otomatik kapsadığı için yeni bir policy/grant gerekmedi.

## Faz 2.3 — Analiz delta kartı (2026-08)
- [x] **"Bu analizde ne değişti" kartı.** Her analiz koşusu bir önceki (succeeded/partial) koşuya göre yapılandırılmış bir delta hesaplar ve saklar; Overview'da executive özet/istatistik alanının hemen altında gösterilir (`AnalysisDeltaCard`, bkz. `08-dashboard.md`).
- [x] **Şema:** `analysis_runs.delta jsonb` (migration `20260823000100_analysis_runs_delta.sql`) — sadece succeeded/partial run'larda dolu, mevcut RLS policy/grant'ları tablo bazlı olduğu için yeni bir policy/grant gerekmedi.
- [x] **Hesaplama** yeni bir modülde (`src/lib/analysis/analysis-delta.ts`, `execute-analysis.ts`'in şişmemesi için ayrı): saf/test edilebilir `buildAnalysisDelta` + DB'den okuyan ince `computeAnalysisDelta`. "Yeni yorum" sayımı `published_at` değil `scraped_at` baz alır (gerekçe: `05-ai-pipeline.md` "Delta adımı"). "Önceki koşu" referansı ayrı bir sorgu değil, `executeAnalysis`'in kendi güncellemesinden ÖNCEki `businesses.last_scraped_at`.
- [x] **Sıfır yeni görev durumunda sessiz kalınmaz:** `zero_new_tasks_reason` (`no_new_signal` | `all_themes_below_threshold` | `own_analysis_failed` | `stage2_failed`) kullanıcıya "hiçbir şey olmadı" ile "her şey zaten iyi gidiyor"u ayırt ettiren bir cümle olarak gösterilir.
- [x] Birim test: `analysis-delta.test.ts` (zero_new_tasks_reason eşlemesi, top-3 rakip sıralaması, tema başına 5 sınırı).

## Faz 2.4 — Profil farkı görevleri (2026-08)
- [x] **Üçüncü görev kaynağı** (`source_type = 'profile_gap'`): AI çağrısı olmadan, uygulama kodunda zaten sahip olduğumuz veriden (yorum yanıt oranı, Google İşletme Profili website alanı) deterministik üretilir — bkz. `02-business-rules.md` Bölüm D madde 3, `09-task-engine.md`. İki alt kural: yorum yanıt oranı rakip ortalamasına göre belirgin düşükse (`PROFILE_GAP_REPLY_RATE_MIN_COMPETITOR_RATE`, `PROFILE_GAP_REPLY_RATE_MIN_GAP`, `PROFILE_GAP_MIN_OWN_UNREPLIED`), own'un website'ı yoksa ama rakiplerin çoğunda varsa (`PROFILE_GAP_WEBSITE_MIN_COMPETITOR_SHARE`).
- [x] **Şema:** `tasks.source_type` check constraint'i üçüncü değeri kapsayacak şekilde genişletildi (migration `20260823000200_tasks_profile_gap_source_type.sql`); `database.types.ts` diff'i boş (kolon zaten `text`, check constraint'ler codegen'e literal union olarak yansımıyor).
- [x] **Impact score** mevcut `computeCompetitiveGapImpactScore` formülü reuse edilerek hesaplanır (own/rakip oranları prevalence/deficiency olarak yeniden yorumlanır) — ayrı bir formül eklenmedi, görev kartındaki kırılım UI'ı değişmeden çalışır.
- [x] **AI başarısından bağımsız:** own tema analizi ya da Aşama 2 başarısız olsa bile profil farkı adayları hesaplanıp tek başına upsert edilir (`execute-analysis.ts` `upsertProfileGapOnly`); Aşama 2 başarılıysa AI adaylarıyla `rankCandidates`'tan önce birleştirilip aynı `MAX_NEW_TASKS_PER_CYCLE` kotası için yarışır.
- [x] **UI:** görev kartındaki tema etiketi artık AI temaları için olduğu gibi, `profile:*` anahtarları için `business.tasks.profileThemes.*` çeviri anahtarına eşlenir; `profile_gap` görevlerinde ayrıca bir kaynak rozeti (`business.tasks.sourceType.profile_gap`) gösterilir. Kanıt satırı (`TaskEvidenceLine`) bu kaynak için `theme_summary` eşleşmesi olmadığından sessizce gizlenir (crash/uydurma sayı yok).
- [x] Birim test: `profile-gap-candidates.test.ts` (her iki kural için eşik/uygunluk, `based_on_competitor_id` seçimi — eşitlikte en çok yoruma sahip rakip, impact kırılımı, veri yetersizken boş dizi).

## Faz 2.5 — Fırsat tahmini kartı (2026-08)
- [x] **"Fırsat tahmini" kartı.** Overview'da "Bu analizde ne değişti" kartının hemen altında, rakip
  medyanına göre puan/yorum-hızı açığını **her zaman bantlı** gösterir — asla kesin bir öngörü değil
  (CLAUDE.md, bu dokümandaki Faz 1.2 notu "asla '+0.18 yıldız' gibi kesin tahmin verilmez"). Kıyaslanabilir
  veri yoksa kart hiç render edilmez (`OpportunityEstimateCard`, bkz. `08-dashboard.md`, `09-task-engine.md`
  "Opportunity Estimate").
- [x] **Saf hesaplama katmanı** (`src/lib/task-engine/opportunity-estimate.ts` + birim test): rating gap
  (rakip medyanı − own), gap pozitifse yayınlanmış "+1 yıldız ≈ +%5-9 gelir" elastikiyetinden gelir etkisi
  bandı, iki opsiyonel iş girdisi (ortalama hasta değeri, aylık yeni hasta sayısı) doluysa yıllık $ bandı
  (2 anlamlı basamağa yuvarlı), 4.0 filtre eşiği uyarısı, son 90 günlük own/rakip yorum hızı kıyası.
- [x] **Şema:** `businesses.avg_patient_value_usd numeric null`, `businesses.monthly_new_patients integer
  null` (migration `20260823000300_businesses_opportunity_inputs.sql`) — ikisi de opsiyonel, işletme
  düzenleme formunda girilir, mevcut RLS policy/grant'ları tablo bazlı olduğu için yeni bir policy/grant
  gerekmedi.
- [x] **API:** `PATCH /api/business/:id` iki alanı da opsiyonel + nullable kabul eder (`updateBusinessSchema`),
  detay `04-api.md`.
- [x] Birim test: `opportunity-estimate.test.ts` (rating gap yönü/yuvarlama, gelir bandı yalnızca gap>0'da,
  $ bandı yalnızca girdiler doluyken + 2 anlamlı basamak yuvarlama, 4.0 eşik uyarısı, yorum hızı oranı/null
  durumu).

## Faz 2.6 — Görev sonuç takibi (2026-08)
- [x] **Per-task outcome tracking.** Her görev, oluşturulduğu andaki ölçülebilir sinyal durumunu
  (`tasks.outcome_baseline`) ve her sonraki analiz döngüsündeki en güncel durumu (`tasks.outcome_latest`)
  saklar — ürünün "işe yaradı mı?" kanıtı ("oluşturulduğunda olumsuz bahsedilme %45 → şimdi %20, iyileşti").
  Bkz. `09-task-engine.md` "Görev sonuç takibi".
- [x] **Şema:** `tasks.outcome_baseline jsonb null`, `tasks.outcome_latest jsonb null` (migration
  `20260823000400_tasks_outcome.sql`), additive diff.
- [x] **Saf hesaplama katmanı** (`src/lib/task-engine/task-outcome.ts` + birim test, 24 test): görev
  türüne göre üç metric türü (`theme` — own tema kırılımı, `reply_rate`, `website`), zod ile güvenli jsonb
  okuma (`parseOutcomeMetric`), baseline→latest kıyasından verdict türetme (`compareOutcome`,
  `THEME_TREND_DELTA_THRESHOLD`/`TASK_MENTION_THRESHOLD` reuse edilir, ayrı bir sabit ailesi açılmadı).
- [x] **Yazma akışı** (`execute-analysis.ts`): yeni görev insert edilirken baseline donar; task upsert'inden
  hemen sonra `refreshTaskOutcomes` (`src/lib/analysis/task-outcomes.ts`) tüm `open`/`done` görevlerin
  `outcome_latest`'ini tazeler, migration öncesi görevlerde (`outcome_baseline` null) baseline'ı da aynı
  ilk ölçümle doldurur. Skorlama/kota mantığına dokunulmadı.
- [x] **UI:** Tasks ve History sayfalarında (`TaskCardBody`, ortak bileşen) kanıt satırının altında yeni bir
  sonuç takibi satırı (`task-outcome-line.tsx`) + iyileşti/kötüleşti/değişmedi rozeti; baseline/latest eksikse
  ya da henüz ikinci ölçüm yoksa (aynı `measured_at`) satır hiç render edilmez.
- [x] Birim test: `task-outcome.test.ts` (üç metric türü, absent/eşik davranışı, verdict eşikleri, zod parse
  güvenliği).

## Faz 2.7 — Canlı puan ve rakip uyarıları (2026-08)
- [x] **Problem:** `businesses.rating`/`competitors.rating` yalnızca ilk Apify enrichment'ında yazılıyordu —
  Google yorum actor'ü yorum başına puan döndürür ama toplu puanı güncellemez. Sonuç: Competitor Rank, Trend
  grafiği ve Competitors sayfası onboarding sonrası hiç değişmiyordu; rakip bir sıçrama yaşadığında da
  kullanıcıya hiçbir uyarı gitmiyordu.
- [x] **Şema:** `businesses`/`competitors`'a `recent_rating numeric`, `recent_rating_reviews integer`,
  `recent_rating_window_days integer`, `recent_rating_updated_at timestamptz` (4'er kolon);
  `clinic_score_history.recent_ratings jsonb`; `notifications.type` check constraint'i üç yeni değeri
  (`competitor_review_surge`, `competitor_rating_shift`, `competitor_negative_spike`) kapsayacak şekilde
  genişletildi (migration `20260823000500_recent_ratings_and_competitor_alerts.sql`, additive diff).
- [x] **Canlı puan** (`src/lib/analysis/recent-ratings.ts` + birim test): analiz penceresindeki taze
  yorumların `rating`lerinden hesaplanan ortalama (`RECENT_RATING_MIN_REVIEWS` altında null), own+rakip
  `recent_rank`i (resmi Competitor Rank'ten AYRI). Detay: `02-business-rules.md` Bölüm F.
- [x] **Rakip uyarıları** (`src/lib/analysis/competitor-alerts.ts` + birim test): yorum patlaması
  (`competitor_review_surge`), puan sıçraması (`competitor_rating_shift`), negatif tema patlaması
  (`competitor_negative_spike`) — eşikler `02-business-rules.md` Bölüm G. Her uyarı `notifications`'a
  kaydedilir (haftalık özete dahil) ve `AnalysisDelta.alerts`'e eklenir (opsiyonel alan, `version: 1` korundu).
- [x] **Wiring:** `execute-analysis.ts` `runAnalysisPipeline` — canlı puan hesaplaması Aşama 1 ile paralel;
  rakip uyarıları delta hesaplandıktan hemen sonra (`countNewCompetitorReviews` export edilip iki tarafta da
  reuse edildi, ekstra sorgu yok).
- [x] **UI:** Competitors kartlarında "Son N gün" canlı puan satırı (null ise gizli); Trend grafiğinde own vs
  rakip-medyan canlı puan serisi (iki ek çizgi, `connectNulls`); Overview "Bu analizde ne değişti" kartında
  "Uyarılar" rozet listesi (`analysis-delta-alerts.tsx`).
- [x] Haftalık özet e-postasına (tr/en) üç yeni satır şablonu eklendi.
- [x] Birim test: `recent-ratings.test.ts` (15 test — `computeRecentRating`, `computeRecentRank`, `median`,
  `extractRecentRatingTrendPoint`), `competitor-alerts.test.ts` (14 test — üç alert türü + çoklu rakip).

## Faz 2.8 — Tema etiketi kayması düzeltmesi (2026-08)
- [x] **Problem (gerçek veriyle bulundu):** Mersin diş kliniği pilotunda, aynı yorumlar üzerinde ard arda
  koşulan iki analiz döngüsünde Aşama 1 modeli aynı konuya farklı tema etiketleri verdi — ör. "Tedavi
  sürecinde bilgilendirme ve şeffaflık" → "Tedavi süreci hakkında detaylı bilgilendirme", "Sahte online yorum
  iddiası" → "Sahte yorum ve itibar manipülasyonu şüphesi", "Randevu sürecinin esnekliği ve sorunsuzluğu" →
  "Hızlı iletişim ve randevu kolaylığı". Kod tabanındaki HER tema-tabanlı eşleştirme normalize edilmiş
  (trim+lowercase) EXACT string eşitliği kullandığından (bilinçli bir Faz 1 sınırlaması olarak belgelenmişti,
  bkz. eski `02-business-rules.md` Bölüm C notu), bu kayma sessizce üç gerçek hataya yol açtı: (1) `upsertTasks`
  dedup'u (theme+source_type+status='open') kaçırdı → aynı klinik için 2. döngüde 5 yeni neredeyse-mükerrer
  görev oluştu (toplam 10) — ürünün "az sayıda, tamamlanabilir görev listesi" ilkesini bozuyordu; (2)
  `buildOutcomeMetric` eski etiketi "absent" sayıp `compareOutcome`'ın "tema tamamen kayboldu" kısayolunu
  tetikleyerek sahte bir "improved" verdict'i üretti; (3) `theme_summary.trend` ve dismissed-task reopen
  kuralı sessizce hiç eşleşmedi.
- [x] **Birincil çözüm — known-theme vocabulary (Aşama 1 girdisine sözlük).** Bir önceki döngüde kullanılmış
  tema etiketleri (own çağrısı için own'un kendi etiketleri, her rakip çağrısı için önceki AGREGAT rakip
  etiketleri — tek tek rakip değil) Aşama 1 prompt'una `knownThemes` olarak geçirilir; model aynı konu için
  bu etiketlerden birini AYNEN tekrar kullanmaya yönlendirilir (bir sözlük, kontrol listesi değil — var
  olmayan bir tema için zorla mention uydurmaz). Sağlayıcıdan bağımsız (`Stage1ExtractThemesParams`,
  `src/lib/ai-pipeline/theme-extraction-schema.ts`), Claude/Gemini implementasyonları (`src/lib/claude/`,
  `src/lib/gemini/theme-extraction.ts`) sadece paylaşılan tipi kullanacak şekilde güncellendi, prompt
  mantığında değişiklik gerekmedi. Sözlük prompt boyutunu sınırlamak için en çok bahsedilen temadan başlayarak
  `STAGE1_KNOWN_THEME_VOCABULARY_LIMIT` (40) ile sınırlanır. Wiring: `execute-analysis.ts`
  `fetchPreviousThemeData` — önceki döngünün `theme_summary` satırları bu döngüde silineceği için (delete-then-
  reinsert), hem trend karşılaştırma verisi hem de sözlükler Stage 1 çağrılarından ÖNCE, TEK sorguda okunur.
- [x] **İkincil güvenlik ağı — morfolojik benzerlik.** Yeni modül `src/lib/task-engine/theme-similarity.ts`:
  `normalizeTheme` (tek implementasyon — `reopen.ts`'ten taşındı, oradan re-export edilir) + `findSimilarTheme`
  (normalize → tokenize → 3 karakterden kısa token'ları ve tr/en stopword'leri düşür → her token'ı ilk 5
  karaktere kırp (kaba Türkçe ek toleransı) → Jaccard benzerliği ≥ `THEME_SIMILARITY_THRESHOLD` (0.6) olan en
  iyi aday). SADECE iki yerde kullanılır (trend/reopen semantiği KASITLI OLARAK değiştirilmedi — hâlâ yalnızca
  exact match): `upsertTasks` dedup'unda exact eşleşme kaçarsa aynı `source_type`'taki açık görevler arasında
  benzer tema aranır (bulunursa mevcut görev güncellenir, theme kolonu ve `outcome_baseline` dokunulmadan
  kalır — YENİ görev eklenmez), ve `buildOutcomeMetric`'te exact eşleşme kaçarsa "absent" sonucuna varmadan
  önce benzer tema aranır.
- [x] **Dürüstçe belgelenen sınır:** gerçek pilot verisindeki üç etiket çiftinin HİÇBİRİ (yukarıdaki örnek)
  benzerlik güvenlik ağının eşiğini geçmiyor (ölçülen jaccard: 0.5 / 0.286 / 0.143 — hepsi tam rephrasing,
  neredeyse hiç ortak token yok) — bunları yakalamak Part A'nın (vocabulary) işi. Güvenlik ağı yalnızca dar
  morfolojik varyantları yakalar (ör. "randevu süreci"/"randevu sürecinde", "temizlik"/"temizliği" — jaccard
  1.0); hatta aynı "aile"den bazı varyantlar bile (ör. "bekleme süresi"/"bekleme süreleri" — jaccard ≈ 0.33)
  5-karakter kırpmanın eki her zaman aynı noktada kesmemesi yüzünden eşiğin altında kalabilir. Eşik bilinçli
  olarak DÜŞÜRÜLMEDİ — alakasız temaların yanlışlıkla birleşme riskini artırırdı.
- [x] **Şema/migration yok** — additive kod değişikliği, hiçbir tablo/kolon eklenmedi.
- [x] Birim test: `theme-similarity.test.ts` (gerçek üç cycle-1→cycle-2 çiftinin hiçbirinin eşleşmediğini,
  morfolojik varyantların eşleştiğini tablo halinde doğrular), `task-outcome.test.ts`'e eklenen fuzzy-match
  testleri (absent yerine gerçek kırılım, sahte "improved" üretilmediği), `execute-analysis.test.ts`'e eklenen
  `upsertTasks` testleri (fuzzy eşleşmede insert değil update, theme/outcome_baseline dokunulmaz; gerçek tam
  rephrasing'de güvenlik ağı da bulamayınca insert edildiği).
- [x] Docs senkronu: `05-ai-pipeline.md` (known-theme vocabulary adımı), `06-prompts.md` (Aşama 1 sözlük
  kuralı), `02-business-rules.md` Bölüm C/D/E ("fuzzy eşleştirme yok" notları revize edildi), `09-task-engine.md`
  (dedup + outcome eşleştirme).

## Faz 2.9 — Sonuç metriği kaynak tipine göre + tema kanonikleştirme (2026-08)
- [x] **Problem (gerçek pilotta ÜÇ ard arda analiz döngüsü çalıştırılarak bulundu, 12 görev):** 11 tema-tabanlı
  görevin 8'inde `outcome_latest.absent = true` — özellik hiçbir şey ölçmüyordu. İki ayrı kök neden:
  (1) `competitive_gap` görevleri TANIM GEREĞİ own tarafında zaten `absent` başlar (rakip güçlü, klinik bu
  konuda hiç konuşmuyor) — `negative_ratio`'yu izlemek anlamsız (baseline %0 → latest %0, UI'da gürültülü bir
  "olumsuz bahsedilme %0 → %0" satırı); gerçek sinyal own OLUMLU mention'ların başlaması/artmasıdır.
  (2) Aşama 2 (gap analizi) `theme` alanına kendi serbest ifadesini yazabiliyordu (Aşama 1'e verilen known-theme
  vocabulary'den BAĞIMSIZ bir üçüncü drift kaynağı) — gerçek pilot örneği: "Sahte online yorum iddiası" görevi
  (cycle 1, `absolute_quality`, own negative_ratio 1.0) cycle 2/3'te Aşama 1 aynı konuyu "Sahte yorum ve itibar
  manipülasyonu şüphesi" etiketledi, eski `compareOutcome`'ın "tema tamamen kayboldu ⇒ improved" kısayolu
  yüzünden ürün gerçekleşmemiş bir kazanım ("improved") iddia ediyordu.
- [x] **Çözüm 1 — Aşama 2 çıktısının kod tarafında kanonikleştirilmesi.** Sistem promptu artık `theme`
  alanının verilen own/rakip tema listelerinden BİREBİR (verbatim) kopyalanması gerektiğini açıkça istiyor
  (`gap-analysis-schema.ts` `buildStage2SystemPrompt`/`buildStage2UserPrompt`, bkz. `06-prompts.md`) — ama
  modele bu kuralla birlikte de güvenilmez: `canonicalizeCandidateThemes` (`src/lib/analysis/task-candidates.ts`)
  Aşama 2'nin ham çıktısını `filterCandidates`'a girmeden ÖNCE own+rakip AGREGAT etiketlerinin birleşimine
  eşler (ÖNCE exact normalize eşleşme, bulunamazsa `findSimilarTheme` fuzzy güvenlik ağı, ikisi de kaçarsa
  aday olduğu gibi bırakılır). Wiring: `runStage2AndUpsertTasks` (`execute-analysis.ts`).
- [x] **Çözüm 2 — açık görev etiketleri Aşama 1 sözlüğünde PIN'lenir.** `fetchPreviousThemeData` artık
  business'ın `status='open'` görevlerinin `theme`'lerini de okur (`profile:*` hariç) ve own known-theme
  sözlüğüne (`buildThemeVocabulary`) PIN olarak geçirir — pinned etiketler ÖNCE eklenir, `STAGE1_KNOWN_THEME_VOCABULARY_LIMIT`
  (40) cap'i sadece kalan (mention sayısına göre sıralı) sıradan temaları sınırlar; bir görev hâlâ açıkken onun
  etiketi sözlükten asla düşürülmez.
- [x] **Çözüm 3 — kaynak tipine göre iki ayrı outcome verdict mantığı.** `OutcomeMetric`'in `theme` varyantı
  artık `positive_ratio`, `source_type` (`competitive_gap`/`absolute_quality`) ve `own_theme_count` (bu ölçümün
  alındığı döngüde own Aşama 1'in ürettiği TOPLAM tema sayısı) taşıyor. `compareOutcome` `latest.source_type`'a
  göre dallanır: `absolute_quality` eski ratio-tabanlı semantiği korur, tek fark eski "tema kayboldu ⇒ improved"
  kısayolunun artık `latest.own_theme_count > 0` şartına bağlı olması (own bu döngü hiçbir tema üretmediyse —
  own Aşama 1 başarısız oldu ya da gerçekten tekrar eden tema yoksa — `absent` güvenilir bir "kayboldu" sinyali
  DEĞİLDİR, verdict `null` döner, satır gizlenir). `competitive_gap` YENİ bir karşılaştırıcı kullanır: own
  OLUMLU mention'ları `TASK_MENTION_THRESHOLD` (3) eşiğini geçip aynı miktarda arttıysa `improved`, aynı miktarda
  düştüyse `worsened`, own her iki döngüde de hiç mention almadıysa (`positive === 0` iki tarafta da) `null`
  (anlamsız "%0 → %0" satırı gösterilmez). Detay ve tam eşik tablosu: `09-task-engine.md` "Faz 2.9".
- [x] **Geriye dönük uyumluluk.** Faz 2.6-2.8'de yazılmış eski satırlarda (local DB'de gerçekten 12 görev)
  `positive_ratio`/`source_type`/`own_theme_count` yok — `parseOutcomeMetric` zod şeması bu üç alanı opsiyonel
  bırakır, eksik olanları güvenli varsayılanlarla doldurur (`source_type` → `absolute_quality`, `own_theme_count`
  → `0` — bilinçli olarak temkinli, eski veride bu bilgi hiç kaydedilmedi). Migration yok (ikisi de zaten
  `jsonb`, additive).
- [x] **UI:** `task-outcome-line.tsx` artık `latest.source_type`'a göre farklı bir cümle render eder —
  `absolute_quality` eski "olumsuz bahsedilme %B → %L" metnini korur, `competitive_gap` own olumlu mention
  sayısını gösterir ("Bu konuda olumlu bahsedilme: B → L"); `compareOutcome` `null` dönerse (yukarıdaki
  "ölçemedik"/"anlamsız 0→0" durumları) satır hiç render edilmez. `messages/tr.json`+`en.json`'a yeni
  `business.tasks.outcome.competitiveGap` anahtarı eklendi (iki locale'de de aynı anahtar).
- [x] **Şema/migration yok** — additive kod değişikliği, `tasks.outcome_baseline`/`outcome_latest` zaten `jsonb`.
- [x] Birim test: `task-outcome.test.ts` (37 test — competitive_gap improved/worsened/flat/null, absolute_quality
  own_theme_count-gated absent kısayolu, gerçek pilot false-positive senaryosunun regresyon testi, eski format
  JSON'un crash etmeden absolute_quality'e düştüğü), `task-candidates.test.ts`'e eklenen `canonicalizeCandidateThemes`
  testleri (exact eşleşme, fuzzy eşleşme, no-match passthrough), `execute-analysis.test.ts`'e eklenen
  `buildThemeVocabulary` pin/cap etkileşim testleri.
- [x] Docs senkronu: `09-task-engine.md` (outcome bölümü yeniden yazıldı — iki metrik ailesi, absence kuralı),
  `06-prompts.md` (Aşama 2 theme-verbatim kuralı), `05-ai-pipeline.md` (kanonikleştirme adımı + açık görev
  etiketlerinin sözlükte pin'lenmesi), `02-business-rules.md` Bölüm D (dedup notuna Faz 2.9 eklendi).

## Faz 2.10 — Başarısız analiz sonrası tekrar deneme
- [x] **Problem:** `execute-analysis.ts`, `businesses.last_scraped_at`'i scrape sonrası, AI aşamalarından ÖNCE
  yazıyor. Vercel'in sert `maxDuration=300` sınırı fonksiyonu AI aşamalarında öldürebiliyor (ölçülen: own+3
  rakip gerçek Claude koşusu ~246-270s, tavanın %82-90'ı; bir `withRetryOnce` retry'ı sınırı kolayca aşar).
  Bu durumda `last_scraped_at` zaten yazılmış oluyor ama analiz hiç tamamlanmıyor — kullanıcı sonuç almadan
  tüm cooldown penceresi (Free 30, Pro 7 gün) boyunca kilitleniyor, Apify maliyeti de boşa gidiyor.
- [x] **Çözüm:** `src/lib/task-engine/analysis-cooldown.ts`'e `isRetryAllowedAfterFailure` eklendi — işletmenin
  en son `analysis_runs` satırı `failed` ise ya da stale eşiğini (`ANALYSIS_RUN_STALE_MS`, tek tanım artık
  `src/lib/constants.ts`'te, `acquire-analysis-run.ts` da buradan import ediyor) aşmış terk edilmiş bir
  `running` satırıysa, `run-manual-analysis.ts` cooldown bloğunu atlar ve kullanıcı hemen tekrar deneyebilir.
  Son koşu `succeeded`/`partial` ise normal cooldown aynen uygulanır. Cron döngüsü (`run-cron-analysis-cycle.ts`)
  bilinçli olarak bu davranışı paylaşmaz — sürekli başarısız bir işletmede her günlük tikte tekrar ücretli
  Apify çekimi riskini önlemek için, cron kendi günlük ritmiyle bir sonraki uygun günde normal şekilde dener.
- [x] Docs senkronu: `02-business-rules.md` Bölüm A (cooldown yalnızca tamamlanmış analize uygulanır notu),
  `04-api.md` (manuel run 422 davranışı + cron asimetri notu).
- [x] Birim test: `analysis-cooldown.test.ts` — `isRetryAllowedAfterFailure` (failed/stale-running → true,
  fresh-running/succeeded/partial/null → false), injected `now` ile.
- [x] Şema/migration yok — davranış değişikliği, yeni kolon/tablo eklenmedi.

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
