# 08 — Dashboard

## Executive özet kartı (sayfanın en üstü, Faz 1)
Kullanıcı detay okumadan durumu görmeli. 5 metrik:

| Metrik | Kaynak | Açıklama |
|---|---|---|
| Clinic Score | `clinic_score_history` (en son snapshot) | 0-100, formül `09-task-engine.md` |
| Competitor Rank | `overview` endpoint hesaplar | "4/12" formatında |
| Critical Issues | `tasks` (priority='high', status='open') sayısı | "3 kritik konu" |
| Completed Tasks | `tasks` (status='done') / toplam | "8/11" |
| Potential Rating Gain | açık görevlerin `impact_score` toplamından türetilen tahmini | "+0.3 puan potansiyeli" |

## "Bu analizde ne değişti" kartı (Faz 2.3)
Executive özet/istatistik alanının hemen altında, `AnalysisDeltaCard` (`src/app/(app)/business/analysis-delta-card.tsx`). En son `status in ('succeeded','partial')` ve `delta` dolu olan `analysis_runs` satırını okur (`resolve-analysis-delta.ts`); hiç yoksa (ilk analiz henüz koşmadıysa ya da tüm koşular failed'se) kart hiç render edilmez — boş kart gösterilmez. Şekil ve hesaplama detayı `05-ai-pipeline.md` "Delta adımı", `03-database.md` `analysis_runs.delta`.

Gösterilenler: koşu tarihi + "Son {window_days} gün" pencere bağlamı; own/rakip yeni yorum sayısı (rakip tarafında en çok yeni yorum alan 3 rakip, "en çok: {isim} +{sayı}"); yeni/güncellenen/yeniden açılan görev sayısı; own temalardan kötüleşen/iyileşen/kritik chip listeleri (`Badge`, her biri en fazla 5); yanıtlanmamış own yorum sayısı + Reviews sekmesine link. **Yeni görev sayısı 0 ise** (`tasks_created === 0`), `zero_new_tasks_reason`'a göre açıklayıcı bir cümle gösterilir — ör. "Yeni bir sorun sinyali yok — bu iyi haber" (`no_new_signal`) — böylece kullanıcı sessizliği "bir şey bozuldu mu" diye yorumlamaz.

## "Fırsat tahmini" kartı (Faz 2.5)
"Bu analizde ne değişti" kartının hemen altında, `OpportunityEstimateCard` (`src/app/(app)/business/opportunity-estimate-card.tsx`). Rakip medyanına göre puan/yorum-hızı açığını **her zaman bantlı** gösterir, asla kesin bir öngörü olarak sunulmaz (CLAUDE.md, `10-roadmap.md` "asla '+0.18 yıldız' gibi kesin tahmin verilmez") — hesaplama `src/lib/task-engine/opportunity-estimate.ts`'te saf bir fonksiyon, formül ve sabitler `09-task-engine.md` "Opportunity Estimate"te. Kıyaslanabilir hiçbir veri yoksa (own/rakip puan karşılaştırması VE yorum hızı karşılaştırması ikisi de yoksa) kart hiç render edilmez.

Gösterilenler:
- Yöntem notu (bir satır, "yayınlanmış ortalamalara dayanan kaba bir tahmin" — kesinlik hissi vermez).
- Own puan vs rakip medyanı + fark rozeti ("Rakip medyanının 0.3 puan altındasın" / "0.2 puan öndesin").
- Fark pozitifse (rakip önde): tahmini gelir etkisi bandı (+1 yıldız ≈ %5-9 yayınlanmış yerel işletme elastikiyeti — bkz. `09-task-engine.md`), altında kaynak notu.
- İki opsiyonel iş girdisi (ortalama hasta değeri, aylık yeni hasta sayısı — `businesses.avg_patient_value_usd`/`monthly_new_patients`, işletme düzenleme formunda) doluysa yıllık $ bandı (2 anlamlı basamağa yuvarlı, ör. "≈ $12.000–22.000 / yıl"); doldurulmamışsa girdileri girmeye yönlendiren bir CTA linki (işletme düzenleme formuna, `/business#business-edit`).
- Own puan 4.0 eşiğinin altında VE rakip medyanı üstündeyse uyarı rozeti (hastaların büyük kısmının 4.0 altını filtrelediği kabul edilen eşik).
- Son 90 günde own vs rakip ortalaması aylık yorum hızı satırı; own rakiplerin belirgin gerisindeyse (`OPPORTUNITY_REVIEW_VELOCITY_GAP_RATIO`) uyarı rozeti.

## Sekmeler — Faz 1 (MVP)

**Overview** — Executive özet kartı + "Bu analizde ne değişti" kartı + "Fırsat tahmini" kartı + en yüksek öncelikli 3 görev + kısa trend grafiği önizlemesi.

**Tasks** — Tüm görevler, `status`/`priority` filtreli liste. Her görev: başlık, açıklama, impact/effort göstergesi, hangi rakip(ler)den doğduğu, tamamla/reddet aksiyonları. Görev kartlarında ayrıca kod tarafında hesaplanan bir kanıt satırı gösterilir — `theme_summary`'den own vs rakip mention sayısı kıyası (`competitive_gap` için rakip pozitif/own pozitif, `absolute_quality` için own negatif). Görevin teması ile `theme_summary` satırları eşleşmezse (AI'ın ürettiği tema adı drift ederse) satır gösterilmez, uydurma sayı verilmez.

**Tasks → History (Faz 1.1)** — `/business/tasks/history` alt-görünümü: `status in ('done','dismissed')` görevlerin salt-okunur listesi. Her satırda status rozeti (Tamamlandı/Reddedildi) ve `done` görevler için `completed_at` tarihi (`dismissed`'in kendi timestamp'i yok, tarih gösterilmez; sıralamada `created_at`'a düşülür). Tasks sayfasıyla arasında karşılıklı link vardır, ayrı bir üst sekme değildir.

**Competitors** — Seçilen rakiplerin kartları: puan, yorum sayısı, güçlü/zayıf temalar özeti. Rakip ekleme/çıkarma buradan yönetilir (limit: `02-business-rules.md` Bölüm A).

**Reviews** — Kullanıcının **kendi** yorumlarının, rekabet çerçevesi olmadan doğrudan listesi. Filtre: puan, tarih, yanıtlanmış/yanıtlanmamış (`owner_reply` boş mu). Her satırda: puan, tema etiketleri (theme_summary'den), yanıt durumu, `review_url` linki. Amaç: kullanıcının "rakiplere göre" değil, kendi hastasına göre durumu tek tek görebileceği bir yer olması — Görev motoru önemli sinyalleri özetliyor ama bazen kullanıcı sadece "son yorumlarımı okumak" istiyor, bu ihtiyacı Themes/Tasks sekmeleri karşılamıyor.

**Not (Faz 1 ilk sürüm):** Reviews sekmesi şu an tema etiketleri olmadan gönderildi — `review_analysis` (yorum-bazlı tema/duygu granülaritesi tutan tek tablo) hiçbir kod yolunda doldurulmuyor, `theme_summary` ise dönem bazlı bir toplam olup tek bir yoruma bağlanamıyor. Yorum başına tema etiketi eklemek AI pipeline/prompt sözleşmesinde (`05-ai-pipeline.md`, `06-prompts.md`) bir genişleme gerektiriyor — ayrı bir iterasyona bırakıldı.

**Themes** — `theme_summary` tablosundan kendi vs rakip karşılaştırması, tema bazlı pozitif/negatif mention sayıları. **Bug fix (Faz 2 kapanışı):** sorgu `competitor_id IS NULL` filtresi eklenmeden yazılmıştı; Faz 1.2'nin rakip bazlı kırılım satırları (`competitor_id` dolu) devreye girdiğinde `buildThemeRows`'un `existing.competitor = cell` ataması (toplama değil) sorgu sırasına göre rastgele TEK bir rakibin sayısını "Competitors (combined)" diye gösteriyordu — filtre eklenip gerçek oturumla doğrulandı.

**Trend** — `clinic_score_history`'den zaman serisi grafiği (Clinic Score ve Competitor Rank'in zaman içindeki değişimi). Veri biriktikçe anlamlı olur — ilk haftalarda "yeterli veri birikiyor" mesajı gösterilir.

## Monthly Report (Faz 2 — teslim edildi)
Overview sekmesinde, en az bir `clinic_score_history` snapshot'ı varsa görünen bir "Aylık raporu indir (PDF)" aksiyonu — ayrı bir nav sekmesi/sayfası değil. `GET /api/business/:id/monthly-report` (kullanıcı oturumuyla, RLS) `@react-pdf/renderer` ile tek sayfalık bir PDF üretir: Clinic Score + son 30 güne göre delta, Competitor Rank, Critical Issues, bu dönem tamamlanan görev sayısı, Potential Rating Gain, own theme_summary'den en çok bahsedilen 3 pozitif/3 negatif tema, executive summary metni. "Dönem" son 30 gün olarak sabit değil — kadans adaptif/haftalık olduğu için tam 30 gün öncesine en yakın (o tarihten önceki en son) snapshot'a düşülür; hiç yoksa delta gösterilmez (bkz. `src/lib/reports/monthly-report-data.ts`).

Aynı rapor artık pasif indirmenin yanında **aktif teslimat** olarak da işletme başına ~30 günde bir e-posta + PDF ek olarak gönderiliyor (`sendMonthlyReportEmails`, `02-business-rules.md` Bölüm G, `04-api.md`) — kullanıcı dashboard'a girmese bile rapor kendisine ulaşır.

**Font notu:** react-pdf'in gömülü Helvetica'sı Türkçe karakterleri (ı, ş, ğ) desteklemiyor; Google Fonts'un CDN "latin"/"latin-ext" alt kümeleri de Türkçe alfabeyi tek dosyada karşılamıyor (ı "latin"de, ş/ğ "latin-ext"te — ikisi ayrı embed edilemiyor). Çözüm: Google'ın kaynak deposundaki değişken Noto Sans fontundan Regular/Bold statik enstantane çıkarılıp Latin+Latin Extended-A aralığına subset'lenerek `src/lib/reports/fonts/`'a gömüldü (bkz. `pdf-fonts.ts`, `OFL-NOTICE.md`). Turbopack `require.resolve` ile relative bir .ttf'i statik import sanıp build'i kırdığı için yol `process.cwd()` bazlı kuruluyor ve `next.config.ts`'teki `outputFileTracingIncludes` ile serverless bundle'a elle dahil ediliyor.

E-posta ile gönderim (roadmap'teki "PDF/e-posta" ifadesindeki ikinci kanal) bu iterasyonda kapsanmadı — yalnızca indirme aksiyonu var; weekly-digest altyapısına eklenmesi ayrı bir iterasyon.

## Treatments (Faz 2 — teslim edildi)
`/business/treatments` — yeni bir nav sekmesi. `theme_summary.treatment` alanına (Aşama 1 çıktısı, bkz. `05-ai-pipeline.md`) göre own vs rakip (birleşik) kırılımı, Themes sayfasıyla aynı kart/badge tasarımı ama tema yerine tedavi türü bazında toplulaştırılmış. Aynı tedavi türüne birden fazla tema bağlanabilir (ör. "implant ağrısı" + "implant randevu süreci" → "implant") — sayfa bunları tek satırda toplar, tema kırılımını göstermez (o zaten Themes'te var). `treatment IS NULL` olan satırlar (genel temalar) hariç tutulur. Sorgu `competitor_id IS NULL` filtresi kullanır (Themes'teki bug fix'iyle aynı gerekçe).

## Sekmeler — Faz 2 (ertelenen)
Doctor Analysis MVP'de **eklenmiyor** çünkü yorumdan doktor/personel ismi çıkarımı ayrı bir NLP problemi ve ek veri kalitesi/gizlilik riski taşıyor (kişi ismi çıkarımı, temadan farklı bir hassasiyet seviyesi). Şema zaten buna izin veriyor (theme alanı serbest metin), ileride ek bir extraction aşaması olarak eklenebilir.

- **Doctor Analysis** — yorumlardan doktor/personel ismi çıkarımı, kişi bazlı sentiment.
