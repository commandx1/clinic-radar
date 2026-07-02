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

**Tasks** — Tüm görevler, `status`/`priority` filtreli liste. Her görev: başlık, açıklama, impact/effort göstergesi, hangi rakip(ler)den doğduğu, tamamla/reddet aksiyonları.

**Competitors** — Seçilen rakiplerin kartları: puan, yorum sayısı, güçlü/zayıf temalar özeti. Rakip ekleme/çıkarma buradan yönetilir (limit: `02-business-rules.md` Bölüm A).

**Reviews** — Kullanıcının **kendi** yorumlarının, rekabet çerçevesi olmadan doğrudan listesi. Filtre: puan, tarih, yanıtlanmış/yanıtlanmamış (`owner_reply` boş mu). Her satırda: puan, tema etiketleri (theme_summary'den), yanıt durumu, `review_url` linki. Amaç: kullanıcının "rakiplere göre" değil, kendi hastasına göre durumu tek tek görebileceği bir yer olması — Görev motoru önemli sinyalleri özetliyor ama bazen kullanıcı sadece "son yorumlarımı okumak" istiyor, bu ihtiyacı Themes/Tasks sekmeleri karşılamıyor.

**Themes** — `theme_summary` tablosundan kendi vs rakip karşılaştırması, tema bazlı pozitif/negatif mention sayıları.

**Trend** — `clinic_score_history`'den zaman serisi grafiği (Clinic Score ve Competitor Rank'in zaman içindeki değişimi). Veri biriktikçe anlamlı olur — ilk haftalarda "yeterli veri birikiyor" mesajı gösterilir.

## Sekmeler — Faz 2 (ertelenen)
Bunlar MVP'de **eklenmiyor** çünkü yorumdan doktor ismi / tedavi türü çıkarımı ayrı bir NLP problemi ve ek veri kalitesi riski taşıyor. Şema zaten buna izin veriyor (theme alanı serbest metin), ileride ek bir extraction aşaması olarak eklenebilir.

- **Doctor Analysis** — yorumlardan doktor/personel ismi çıkarımı, kişi bazlı sentiment.
- **Treatments** — tedavi türü bazlı kırılım (implant, ortodonti vb.).
- **Monthly Report** — PDF/e-posta olarak dışa aktarılabilir aylık özet (ajans kullanımı için white-label potansiyeli).
