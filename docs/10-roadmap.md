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
- Karışık dilli yorum kırılımı — turistik/uluslararası hasta çeken klinikler için yorumları dil/köken bazında ayrıştırma (herhangi bir ülkede uygulanabilir, tek bir ülkeye özel bir senaryo değil)
- Ajans / white-label paneli (çoklu işletme yönetimi)
- Doctor Analysis, Treatments sekmeleri (`08-dashboard.md`)
- Monthly Report (PDF export)
- Akıllı rakip önerisi (fiyat segmenti, tedavi türü benzerliği — şu an kullanıcı checkbox ile seçtiği için ertelendi)

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
