# 05 — AI Pipeline

> **Geçici sağlayıcı notu:** Anthropic hesabındaki kredi bakiyesi tükendiği
> için pipeline şu an `AI_PROVIDER=gemini` ile Google Gemini üzerinden
> çalışıyor (bkz. CLAUDE.md Stack, `src/lib/ai-pipeline/provider.ts`). Bu
> dokümandaki "Claude" referansları mimari/tasarım kararını anlatıyor —
> sağlayıcı kredi yenilenince `AI_PROVIDER=claude`'a geri dönecek.

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
- **Ne zaman çalışır:** yeni yorum çekildiğinde (ilk analiz + haftalık/aylık yenileme). Haftalık yenileme Faz 1.1'de gerçek: Pro plan işletmeleri `/api/cron/weekly-analysis` üzerinden otomatik yeniden analiz edilir (bkz. `04-api.md`); her koşu — manuel ya da cron — `analysis_runs` tablosuna loglanır (`03-database.md`); koşuyla birlikte scrape gözlemlenebilirlik metrikleri de yazılır (`scrape_success`, `fetched_reviews`, `scrape_latency_ms`, `scrape_cost_usd` — Risk 3 sinyalleri, bkz. `11-risks-assumptions.md`; ölçüm `executeAnalysis` içinde yapılır, davranışı değiştirmez). **Cron sınırlaması:** otomatik run'larda `outputLanguage = defaultLocale ("en")` kullanılır — TR kullanıcı cron çıktısını İngilizce alabilir; kabul edilen bir Faz 1.1 sınırıdır (kalıcı çözüm: kullanıcı locale tercihinin persist edilmesi, sonraya).
- **Input:** bir işletmenin (own ya da bir competitor) son 90 günlük (own tarafında yetersizse adaptif olarak 180/365 güne genişleyen — bkz. `02-business-rules.md` Bölüm C) yorumları, ham metin + puan + dil.
- **Dil tespiti ve temizlik:** aynı çağrının içinde, prompt'ta talep edilir — ayrı adım değil.
- **Output şeması:** `06-prompts.md`'de tanımlı (toplulaştırılmış tema listesi — yorum bazlı değil), `theme_summary` tablosuna yazılır. `review_analysis` (yorum bazlı emotion/urgency/confidence) bu şema ile üretilemiyor — Faz 1'de yazılmıyor, hiçbir kod da okumuyor; yorum bazlı sinyal gerektiğinde Aşama 1 prompt şeması ayrıca genişletilmeli (ertelenen bir geliştirme).
- **Treatment alanı (Faz 2):** her tema öğesi opsiyonel bir `treatment` (tedavi/hizmet türü — implant, ortodonti, botoks vb.) alanı taşır; kategoriden bağımsız serbest metin, kapalı bir liste değil, model temayı genel bir konuyla (ör. "bekleme süresi") ilişkilendirirse null bırakır. `aggregate-competitor-themes.ts` aynı normalize temaya birden fazla kaynaktan gelen öğelerde ilk görülen null olmayan `treatment` değerini kullanır (fuzzy/oy çoğunluğu yok — theme label seçimiyle aynı basitleştirme). Dashboard'daki Treatments sekmesi bunu tema yerine tedavi türüne göre toplulaştırır (`08-dashboard.md`).
- **own vs competitor toplulaştırması:** Aşama 1, own + her seçili rakip için AYRI AYRI çağrılır (rakip bazlı analiz doğruluğu ve Aşama 2'nin rakip kimliğine ihtiyacı için). Ama `theme_summary.owner_type='competitor'` satırları TEK bir rakibi değil, TÜM seçili rakiplerin toplamını temsil eder (tabloda rakip kimliğini tutan bir kolon yok, bkz. `03-database.md`) — N rakibin Aşama 1 çıktısı tema bazında (normalize edilmiş isimle, fuzzy eşleştirme yok) toplanıp tek bir `owner_type='competitor'` satır kümesi olarak yazılır.
- **Negatif/pozitif mention eşiği** (`02-business-rules.md` Bölüm D) burada değil, Aşama 2'de görev filtrelemesinde uygulanır.
- **Severity alanı:** her tema öğesi bir `severity: "normal" | "critical"` alanı taşır. Model, temaya değinen yorumlardan en az biri sağlık/güvenlik zararı, ciddi bir etik/yasal risk ya da dolandırıcılık iddiası içeriyorsa `critical` işaretler — mention_count'tan bağımsız (`06-prompts.md`). `aggregate-competitor-themes.ts` aynı normalize temaya gelen birden fazla kaynaktan HERHANGİ BİRİ `critical` derse aggregate `critical` olur. `theme_summary.severity`'ye yazılır ve own tarafında Aşama 2 filtrelemesindeki mention eşiğini atlamak için kullanılır (`02-business-rules.md` Bölüm D).

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

## Hata toleransı
- Claude'un JSON çıktısı şema doğrulamasından geçmezse (örn. eksik alan): tek retry, hâlâ başarısızsa o işletme için analiz "pending" olarak işaretlenir, kullanıcıya "analiz devam ediyor" gösterilir — sessizce yarım veri gösterilmez.
