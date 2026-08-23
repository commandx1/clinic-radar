# 05 — AI Pipeline

> **Geçici sağlayıcı notu:** Temmuz 2026'da Anthropic kredisi yenilendiğinde
> aktif sağlayıcı `AI_PROVIDER=claude`'a geri döndü — pipeline şu an Claude
> üzerinden çalışıyor (bkz. CLAUDE.md Stack, `src/lib/ai-pipeline/provider.ts`).
> Google Gemini implementasyonu (`src/lib/gemini/`) yedek sağlayıcı olarak
> duruyor; kredi sorunu tekrar yaşanırsa geçiş yalnızca `AI_PROVIDER=gemini`
> ortam değişkenini ayarlamayı gerektirir.

## Tasarım kararı: neden 2 zengin çağrı, 10 mikroservis değil

Klasik NLP mimarisinde (embedding → ayrı theme detection → ayrı intent detection → ...) her aşama ayrı bir model/servis gerektirirdi çünkü hiçbiri "anlamıyordu", sadece pattern eşleştiriyordu. Claude gibi bir LLM ile bu artık geçerli değil: **temizlik, dil tespiti, tema, duygu, intent aynı yapılandırılmış (structured JSON) çağrıda çıkarılabilir.** Bunu 6-8 ayrı mikroservise bölmek, soloyken bakım yükünü büyütür, gecikmeyi artırır ve maliyeti (her aşama ayrı token/API çağrısı) yükseltir, buna karşılık MVP aşamasında ölçülebilir bir kalite kazancı sağlamaz.

**Embedding'e bilinçli olarak MVP'de yer verilmiyor** — embedding'in değeri, binlerce klinik arasında gözetimsiz tema kümeleme veya benzerlik araması yapmak istediğinde ortaya çıkar (Faz 3, "tema taksonomisi" ölçeklenince). Tek bir kliniğin 3-10 rakibinin yorumlarını analiz ederken, Claude'a doğrudan "şu temaları çıkar" demek hem daha ucuz hem daha isabetli.

**Competitor merge ve priority scoring** ayrı mikroservis değil, Aşama 2 çağrısının çıktısının bir parçası (aşağıda).

## Pipeline (uygulanan hali)

```
[Reviews (own + competitors)]
        │
        ▼
┌─────────────────────────────┐
│ Aşama 1: Per-Business        │   → her işletme için ayrı çağrı
│ Theme + Sentiment + Intent    │   Input: o işletmenin yorumları
│ Extraction                    │   Output: review_analysis + theme_summary satırları
└─────────────────────────────┘
        │  (tüm işletmelerin theme_summary'leri toplanır)
        ▼
┌─────────────────────────────┐
│ Aşama 2: Gap Analysis +       │   Input: kendi theme_summary + rakip theme_summary'leri
│ Absolute Quality Check +      │   Output: tasks (impact_score, effort_score,
│ Opportunity Scoring +         │           source_type dahil)
│ Task Generation                │
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│ Aşama 3 (Faz 1.1): Executive │   Input: Clinic Score, task listesi, trend
│ Summary                       │   Output: dashboard'daki tek paragraflık özet
└─────────────────────────────┘
```

## Aşama 1 detayı
- **Ne zaman çalışır:** yeni yorum çekildiğinde (ilk analiz + haftalık/aylık yenileme). Haftalık yenileme Faz 1.1'de gerçek: Pro plan işletmeleri `/api/cron/weekly-analysis` üzerinden otomatik yeniden analiz edilir (bkz. `04-api.md`); her koşu — manuel ya da cron — `analysis_runs` tablosuna loglanır (`03-database.md`); koşuyla birlikte scrape gözlemlenebilirlik metrikleri de yazılır (`scrape_success`, `fetched_reviews`, `scrape_latency_ms`, `scrape_cost_usd` — Risk 3 sinyalleri, bkz. `11-risks-assumptions.md`; ölçüm `executeAnalysis` içinde yapılır, davranışı değiştirmez). **Cron sınırlaması (çözüldü):** otomatik run'larda `outputLanguage`, işletme sahibinin `users.preferred_locale` tercihinden okunur (desteklenen locale listesine göre doğrulanır, null/tanınmayan değerde `defaultLocale`'a düşer) — TR kullanıcı artık cron çıktısını kendi arayüz dilinde alır (bkz. `run-cron-analysis-cycle.ts`).
- **Input:** bir işletmenin (own ya da bir competitor) son 90 günlük (own tarafında yetersizse adaptif olarak 180/365 güne genişleyen — bkz. `02-business-rules.md` Bölüm C) yorumları, ham metin + puan + dil.
- **Dil tespiti ve temizlik:** aynı çağrının içinde, prompt'ta talep edilir — ayrı adım değil.
- **Output şeması:** `06-prompts.md`'de tanımlı (toplulaştırılmış tema listesi — yorum bazlı değil), `theme_summary` tablosuna yazılır. `review_analysis` (yorum bazlı emotion/urgency/confidence) bu şema ile üretilemiyor — Faz 1'de yazılmıyor, hiçbir kod da okumuyor; yorum bazlı sinyal gerektiğinde Aşama 1 prompt şeması ayrıca genişletilmeli (ertelenen bir geliştirme).
- **Treatment alanı (Faz 2):** her tema öğesi opsiyonel bir `treatment` (tedavi/hizmet türü — implant, ortodonti, botoks vb.) alanı taşır; kategoriden bağımsız serbest metin, kapalı bir liste değil, model temayı genel bir konuyla (ör. "bekleme süresi") ilişkilendirirse null bırakır. `aggregate-competitor-themes.ts` aynı normalize temaya birden fazla kaynaktan gelen öğelerde ilk görülen null olmayan `treatment` değerini kullanır (fuzzy/oy çoğunluğu yok — theme label seçimiyle aynı basitleştirme). Dashboard'daki Treatments sekmesi bunu tema yerine tedavi türüne göre toplulaştırır (`08-dashboard.md`).
- **own vs competitor toplulaştırması:** Aşama 1, own + her seçili rakip için AYRI AYRI çağrılır (rakip bazlı analiz doğruluğu ve Aşama 2'nin rakip kimliğine ihtiyacı için). Ama `theme_summary.owner_type='competitor'` satırları TEK bir rakibi değil, TÜM seçili rakiplerin toplamını temsil eder (tabloda rakip kimliğini tutan bir kolon yok, bkz. `03-database.md`) — N rakibin Aşama 1 çıktısı tema bazında (normalize edilmiş isimle, fuzzy eşleştirme yok) toplanıp tek bir `owner_type='competitor'` satır kümesi olarak yazılır.
- **Negatif/pozitif mention eşiği** (`02-business-rules.md` Bölüm D) burada değil, Aşama 2'de görev filtrelemesinde uygulanır.
- **Severity alanı:** her tema öğesi bir `severity: "normal" | "critical"` alanı taşır. Model, temaya değinen yorumlardan en az biri sağlık/güvenlik zararı, ciddi bir etik/yasal risk ya da dolandırıcılık iddiası içeriyorsa `critical` işaretler — mention_count'tan bağımsız (`06-prompts.md`). `aggregate-competitor-themes.ts` aynı normalize temaya gelen birden fazla kaynaktan HERHANGİ BİRİ `critical` derse aggregate `critical` olur. `theme_summary.severity`'ye yazılır ve own tarafında Aşama 2 filtrelemesindeki mention eşiğini atlamak için kullanılır (`02-business-rules.md` Bölüm D).
- **Known-theme vocabulary (Faz 2.8 — tema etiketi kayması düzeltmesi).** **Problem, gerçek veriyle bulundu:**
  Mersin diş kliniği pilotunda, AYNI yorumlar üzerinde art arda koşulan iki analiz döngüsünde model aynı
  konuya farklı tema etiketleri verdi (ör. "Tedavi sürecinde bilgilendirme ve şeffaflık" → "Tedavi süreci
  hakkında detaylı bilgilendirme", "Sahte online yorum iddiası" → "Sahte yorum ve itibar manipülasyonu
  şüphesi"). Kod tabanındaki her tema-tabanlı eşleştirme (görev dedup, outcome takibi, `theme_summary.trend`,
  dismissed reopen) normalize edilmiş (trim+lowercase) EXACT string eşitliği kullandığı için bu kayma
  sessizce eşleşmeyi kaçırdı — görev dedup'u kaçırınca aynı konu için mükerrer görev oluştu, outcome takibi
  eski etiketi "artık hiç geçmiyor" (absent) sayıp sahte bir "improved" verdict'i üretti.
  **Çözüm:** Aşama 1 çağrısına, önceki analiz döngüsünde AYNI owner scope'unda (own çağrısı için own'un kendi
  önceki etiketleri; her rakip çağrısı için önceki döngünün AGREGAT rakip etiketleri — tek tek rakip değil,
  böylece aynı döngüdeki rakipler arasında da etiketler tutarlı kalır) kullanılmış tema etiketleri, en çok
  bahsedilenden başlayarak en fazla `STAGE1_KNOWN_THEME_VOCABULARY_LIMIT` (40, `constants.ts`) adet
  `knownThemes: string[]` olarak geçirilir (`Stage1ExtractThemesParams`,
  `src/lib/ai-pipeline/theme-extraction-schema.ts` — sağlayıcıdan bağımsız, Claude/Gemini implementasyonları
  aynı tipi kullanır). Model bu listeyi bir SÖZLÜK olarak kullanır: aynı konu için aynı etiketi AYNEN tekrar
  kullanır, ama listedeki bir etiket bu döngünün yorumlarında hiç geçmiyorsa onu zorla kullanmaz (bkz.
  `06-prompts.md`). İlk analizde (önceki döngü yok) liste boştur, prompt'a hiç eklenmez.
  **Wiring:** `execute-analysis.ts` `fetchPreviousThemeData` — önceki döngünün `theme_summary` satırları bu
  döngüde silineceği için (delete-then-reinsert, bkz. aşağıdaki "own vs competitor toplulaştırması"), hem
  trend karşılaştırma verisi (`previousCounts`) hem de bu sözlükler AYNI sorguda, delete'lerden ÖNCE, Stage 1
  çağrılarından ÖNCE okunur.
  **İkincil güvenlik ağı (kod tarafı, AI değil):** vocabulary kuralına rağmen model yine de farklı bir etiket
  üretirse diye `src/lib/task-engine/theme-similarity.ts` (`findSimilarTheme`) morfolojik varyantları (Türkçe
  ek toleranslı, kaba token benzerliği) yakalayan bir güvenlik ağı sağlar — SADECE görev dedup'unda ve outcome
  eşleştirmesinde kullanılır, trend/reopen KASITLI OLARAK hâlâ exact match kullanır. Bu ağın bilinen sınırı:
  tam yeniden ifade etmeleri (yukarıdaki gerçek pilot örnekleri) yakalamaz — onlar için asıl savunma
  yukarıdaki vocabulary kuralıdır. Detay ve eşikler: `02-business-rules.md` Bölüm C/D/E, `09-task-engine.md`.

## Aşama 2 detayı
- **Ne zaman çalışır:** Aşama 1 tüm seçili işletmeler için tamamlandıktan sonra.
- **Input:** kullanıcının theme_summary'si + tüm rakiplerin theme_summary'leri (birleştirilmiş).
- **Mantık:** iki paralel kontrol yapılır (`02-business-rules.md` Bölüm D):
  1. **Rekabetçi fark:** rakip(ler)in güçlü olduğu ama kullanıcının zayıf/eksik olduğu temaları bul.
  2. **Mutlak kalite sorunu:** rakip karşılaştırmasından bağımsız olarak, kullanıcının kendi yorumlarında negatif mention oranı eşiği aşan temaları bul (rakipler de aynı sorunu yaşasa bile).
  Her iki kaynaktan çıkan fırsat için impact_score ve effort_score üret → eşiklere göre filtrele → görev metnini yaz, `source_type`'ı işaretle.
- **Output:** `tasks` tablosuna yazılan, kullanıcı arayüzünde gösterilecek nihai görevler. `title`/`description` `output_language`'a bakmaksızın her zaman hem `tr` hem `en` olarak üretilir ve `title_i18n`/`description_i18n` (jsonb `{tr, en}`) kolonlarına yazılır — kullanıcı arayüz locale'ini sonradan değiştirse bile task doğru dilde görünsün diye (bkz. `06-prompts.md`, `03-database.md`). `output_language` yalnızca Aşama 1'in `theme_summary` çıktısı için kullanılır.

## Aşama 3 (Faz 1.1) detayı
Dashboard'daki executive özet paragrafını üretir ("Bekleme süresi şikayetleri üç aydır düşüyor, bu olumlu bir trend" gibi).
- **Ne zaman çalışır:** Aşama 2 tamamlandıktan sonra, aynı analiz isteği içinde — Clinic Score snapshot'ı yazılmadan hemen önce.
- **Input:** güncel Clinic Score, bir önceki snapshot'ın skoru (`clinic_score_history` — ilk analizde yok), 90 günlük penceredeki done/total görev sayıları ve own `theme_summary` satırları (`trend` alanı dahil; trend kod tarafında hesaplanır, bkz. `02-business-rules.md` Bölüm C). Own Aşama 1 başarısız olsa bile skor + görev sayılarıyla özet yine üretilir.
- **Output:** `output_language`'dan bağımsız her zaman hem `tr` hem `en` üretilir (Aşama 2 task'larıyla aynı gerekçe) ve `clinic_score_history.executive_summary` (jsonb `{tr, en}`) kolonuna snapshot satırıyla birlikte yazılır.
- **Hata toleransı farkı:** Aşama 1/2'deki "pending" semantiği burada yok — tek retry sonrası hâlâ başarısızsa `executive_summary` NULL yazılır ve analiz run'ı başarıyla tamamlanır (özet dekoratif, run'ı düşürmez); UI NULL'da kartı hiç göstermez.

## Delta adımı (Faz 2.3)
Aşama 3'ten sonra, aynı analiz isteği içinde çalışan bir AI-DIŞI kod adımı — `src/lib/analysis/analysis-delta.ts`. Overview'daki "Bu analizde ne değişti" kartı için her koşunun bir önceki (succeeded/partial) koşuya göre yapılandırılmış deltasını üretir ve `analysis_runs.delta` (jsonb) kolonuna yazar (bkz. `03-database.md`, `08-dashboard.md`).
- **"Önceki koşu" referansı:** ayrı bir `analysis_runs` sorgusu değil, `businesses.last_scraped_at`'in `executeAnalysis` tarafından güncellenmeden ÖNCEki değeri (çağıran taraf — `run-manual-analysis.ts`/`run-cron-analysis-cycle.ts` — business satırını zaten bu alanla fetch ediyor). İlk analizde `null`.
- **"Yeni yorum" sayımı `scraped_at` baz alır, `published_at` DEĞİL.** Reviews upsert'i (`execute-analysis.ts` `mapToReviewRows`) `scraped_at`'i hiç payload'a koymuyor; bu kolonun DB default'u (`default now()`) yalnızca İLK insert'te yazılır, aynı `(source, source_ref, review_id)` tekrar upsert edildiğinde dokunulmaz — yani `scraped_at`, "bu satırı sistemde ilk ne zaman gördük" sorusunu güvenilir şekilde yanıtlar. `published_at` (kaynaktaki asıl yayın tarihi) kullanılsaydı, yeni bir rakip eklendiğinde ya da pencere adaptif genişlediğinde (Bölüm C) eskiden yayınlanmış ama bizim için YENİ olan bir yorum yanlışlıkla "yeni değil" sayılabilirdi.
- **Görev sayaçları:** `tasks_created`/`tasks_updated` Aşama 2'nin `upsertTasks` çıktısından, `tasks_reopened` `reopenBurstingDismissedTasks`'ın (Bölüm E, dismissed→open) döndürdüğü sayıdan gelir.
- **`zero_new_tasks_reason`** yalnızca `tasks_created === 0` iken dolar: own Aşama 1 hiç çalışmadıysa `own_analysis_failed`, Aşama 2 başarısızsa `stage2_failed`, own temalar vardı ama Bölüm D eşiklerini geçen hiçbir aday yoksa `all_themes_below_threshold`, aksi halde (own tema yok ya da geçen adaylar zaten mevcut açık görevleri güncelledi) `no_new_signal`.
- **Tema listeleri** (`themes_worsening`/`themes_improving`/`themes_critical`, her biri en fazla 5) own `theme_summary` satırlarının `trend`/`severity` alanlarından türetilir (Bölüm C/D) — ayrı bir AI çağrısı yok.
- Bu adım skorlama/görev/priority mantığını etkilemez, sadece mevcut sonuçları özetler; başarısız olursa (DB hatası) `executeAnalysis` genel akışı düşürmez şeklinde tasarlanmamıştır — delta hesaplaması hata fırlatırsa run "failed" sonuçlanır (dekoratif Aşama 3'ün aksine, delta run'ın normal dönüş değerinin parçasıdır).

## Canlı puan + rakip uyarıları adımı (Faz 2.7)
Aşama 1 ile (own+rakip tema çıkarımı) PARALEL çalışan, AI-DIŞI iki kod adımı — `src/lib/analysis/recent-ratings.ts` ve `src/lib/analysis/competitor-alerts.ts`. İkisi de sadece bu döngünün analiz penceresindeki yorumları okur; Aşama 1/2'nin başarı/başarısızlığından bağımsızdır.

- **Canlı puan (`recent-ratings.ts`):** own + her rakip için, pencere içindeki (`published_at >= windowStartIso`) yorumların `rating`lerinin ortalaması hesaplanıp `businesses`/`competitors`'a yazılır (`recent_rating`, `recent_rating_reviews`, `recent_rating_window_days`, `recent_rating_updated_at`) — eşik altındaysa (`RECENT_RATING_MIN_REVIEWS`) `recent_rating` null kalır. Yazmadan ÖNCE her satırın ÖNCEKİ `recent_rating` değeri okunur (aşağıdaki `competitor_rating_shift` uyarısı için gerekli). Aynı adım own+tüm rakiplerin canlı puanlarından `recent_rank`i hesaplayıp bir sonraki adımda (Aşama 3'ten sonra) `clinic_score_history.recent_ratings` jsonb'sine snapshot olarak yazar. Detay ve eşikler: `02-business-rules.md` Bölüm F.
- **Rakip uyarıları (`competitor-alerts.ts`):** Delta adımı (yukarıda) hesaplandıktan HEMEN SONRA çalışır — delta'nın rakip başına yeni yorum sayımını (`countNewCompetitorReviews`, artık export edilir ve TEK sorguda hem delta'nın top-3 listesi hem de burada TÜM rakipler için reuse edilir) ve rakip bazlı tema kırılımını (`theme_summary`, `competitor_id` dolu satırlar) girdi olarak kullanır. Üç uyarı türü, eşikler ve payload şekli: `02-business-rules.md` Bölüm G. Her tetiklenen uyarı bir `notifications` satırı olarak kaydedilir (`recordNotification`) VE aynı döngünün `AnalysisDelta.alerts`'ine eklenir (bkz. yukarıdaki Delta adımı, `analysis-delta.ts` `AnalysisDeltaAlert`) — `version: 1` korunur, `alerts` opsiyonel bir alandır (eski `delta` satırlarında yok, UI undefined'ı "uyarı yok" olarak ele alır).
- Bu adım da skorlama/görev/priority mantığını etkilemez; hata fırlatırsa (DB hatası) run "failed" sonuçlanır (delta ile aynı davranış — dekoratif değildir, pipeline'ın normal dönüş değerinin parçasıdır).

## Hata toleransı
- Claude'un JSON çıktısı şema doğrulamasından geçmezse (örn. eksik alan): tek retry, hâlâ başarısızsa o işletme için analiz "pending" olarak işaretlenir, kullanıcıya "analiz devam ediyor" gösterilir — sessizce yarım veri gösterilmez.
