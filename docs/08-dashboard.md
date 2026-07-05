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

## Sekmeler — Faz 1 (MVP)

**Overview** — Executive özet kartı + en yüksek öncelikli 3 görev + kısa trend grafiği önizlemesi.

**Tasks** — Tüm görevler, `status`/`priority` filtreli liste. Her görev: başlık, açıklama, impact/effort göstergesi, hangi rakip(ler)den doğduğu, tamamla/reddet aksiyonları. Görev kartlarında ayrıca kod tarafında hesaplanan bir kanıt satırı gösterilir — `theme_summary`'den own vs rakip mention sayısı kıyası (`competitive_gap` için rakip pozitif/own pozitif, `absolute_quality` için own negatif). Görevin teması ile `theme_summary` satırları eşleşmezse (AI'ın ürettiği tema adı drift ederse) satır gösterilmez, uydurma sayı verilmez.

**Tasks → History (Faz 1.1)** — `/business/tasks/history` alt-görünümü: `status in ('done','dismissed')` görevlerin salt-okunur listesi. Her satırda status rozeti (Tamamlandı/Reddedildi) ve `done` görevler için `completed_at` tarihi (`dismissed`'in kendi timestamp'i yok, tarih gösterilmez; sıralamada `created_at`'a düşülür). Tasks sayfasıyla arasında karşılıklı link vardır, ayrı bir üst sekme değildir.

**Competitors** — Seçilen rakiplerin kartları: puan, yorum sayısı, güçlü/zayıf temalar özeti. Rakip ekleme/çıkarma buradan yönetilir (limit: `02-business-rules.md` Bölüm A).

**Reviews** — Kullanıcının **kendi** yorumlarının, rekabet çerçevesi olmadan doğrudan listesi. Filtre: puan, tarih, yanıtlanmış/yanıtlanmamış (`owner_reply` boş mu). Her satırda: puan, tema etiketleri (theme_summary'den), yanıt durumu, `review_url` linki. Amaç: kullanıcının "rakiplere göre" değil, kendi hastasına göre durumu tek tek görebileceği bir yer olması — Görev motoru önemli sinyalleri özetliyor ama bazen kullanıcı sadece "son yorumlarımı okumak" istiyor, bu ihtiyacı Themes/Tasks sekmeleri karşılamıyor.

**Not (Faz 1 ilk sürüm):** Reviews sekmesi şu an tema etiketleri olmadan gönderildi — `review_analysis` (yorum-bazlı tema/duygu granülaritesi tutan tek tablo) hiçbir kod yolunda doldurulmuyor, `theme_summary` ise dönem bazlı bir toplam olup tek bir yoruma bağlanamıyor. Yorum başına tema etiketi eklemek AI pipeline/prompt sözleşmesinde (`05-ai-pipeline.md`, `06-prompts.md`) bir genişleme gerektiriyor — ayrı bir iterasyona bırakıldı.

**Themes** — `theme_summary` tablosundan kendi vs rakip karşılaştırması, tema bazlı pozitif/negatif mention sayıları. **Bug fix (Faz 2 kapanışı):** sorgu `competitor_id IS NULL` filtresi eklenmeden yazılmıştı; Faz 1.2'nin rakip bazlı kırılım satırları (`competitor_id` dolu) devreye girdiğinde `buildThemeRows`'un `existing.competitor = cell` ataması (toplama değil) sorgu sırasına göre rastgele TEK bir rakibin sayısını "Competitors (combined)" diye gösteriyordu — filtre eklenip gerçek oturumla doğrulandı.

**Trend** — `clinic_score_history`'den zaman serisi grafiği (Clinic Score ve Competitor Rank'in zaman içindeki değişimi). Veri biriktikçe anlamlı olur — ilk haftalarda "yeterli veri birikiyor" mesajı gösterilir.

## Monthly Report (Faz 2 — teslim edildi)
Overview sekmesinde, en az bir `clinic_score_history` snapshot'ı varsa görünen bir "Aylık raporu indir (PDF)" aksiyonu — ayrı bir nav sekmesi/sayfası değil. `GET /api/business/:id/monthly-report` (kullanıcı oturumuyla, RLS) `@react-pdf/renderer` ile tek sayfalık bir PDF üretir: Clinic Score + son 30 güne göre delta, Competitor Rank, Critical Issues, bu dönem tamamlanan görev sayısı, Potential Rating Gain, own theme_summary'den en çok bahsedilen 3 pozitif/3 negatif tema, executive summary metni. "Dönem" son 30 gün olarak sabit değil — kadans adaptif/haftalık olduğu için tam 30 gün öncesine en yakın (o tarihten önceki en son) snapshot'a düşülür; hiç yoksa delta gösterilmez (bkz. `src/lib/reports/monthly-report-data.ts`).

**Font notu:** react-pdf'in gömülü Helvetica'sı Türkçe karakterleri (ı, ş, ğ) desteklemiyor; Google Fonts'un CDN "latin"/"latin-ext" alt kümeleri de Türkçe alfabeyi tek dosyada karşılamıyor (ı "latin"de, ş/ğ "latin-ext"te — ikisi ayrı embed edilemiyor). Çözüm: Google'ın kaynak deposundaki değişken Noto Sans fontundan Regular/Bold statik enstantane çıkarılıp Latin+Latin Extended-A aralığına subset'lenerek `src/lib/reports/fonts/`'a gömüldü (bkz. `pdf-fonts.ts`, `OFL-NOTICE.md`). Turbopack `require.resolve` ile relative bir .ttf'i statik import sanıp build'i kırdığı için yol `process.cwd()` bazlı kuruluyor ve `next.config.ts`'teki `outputFileTracingIncludes` ile serverless bundle'a elle dahil ediliyor.

E-posta ile gönderim (roadmap'teki "PDF/e-posta" ifadesindeki ikinci kanal) bu iterasyonda kapsanmadı — yalnızca indirme aksiyonu var; weekly-digest altyapısına eklenmesi ayrı bir iterasyon.

## Treatments (Faz 2 — teslim edildi)
`/business/treatments` — yeni bir nav sekmesi. `theme_summary.treatment` alanına (Aşama 1 çıktısı, bkz. `05-ai-pipeline.md`) göre own vs rakip (birleşik) kırılımı, Themes sayfasıyla aynı kart/badge tasarımı ama tema yerine tedavi türü bazında toplulaştırılmış. Aynı tedavi türüne birden fazla tema bağlanabilir (ör. "implant ağrısı" + "implant randevu süreci" → "implant") — sayfa bunları tek satırda toplar, tema kırılımını göstermez (o zaten Themes'te var). `treatment IS NULL` olan satırlar (genel temalar) hariç tutulur. Sorgu `competitor_id IS NULL` filtresi kullanır (Themes'teki bug fix'iyle aynı gerekçe).

## Sekmeler — Faz 2 (ertelenen)
Doctor Analysis MVP'de **eklenmiyor** çünkü yorumdan doktor/personel ismi çıkarımı ayrı bir NLP problemi ve ek veri kalitesi/gizlilik riski taşıyor (kişi ismi çıkarımı, temadan farklı bir hassasiyet seviyesi). Şema zaten buna izin veriyor (theme alanı serbest metin), ileride ek bir extraction aşaması olarak eklenebilir.

- **Doctor Analysis** — yorumlardan doktor/personel ismi çıkarımı, kişi bazlı sentiment.
