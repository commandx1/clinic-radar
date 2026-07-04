# Yorum Hızı Ölçümü — "dental clinic"

**Parametreler:** lat=30.2672, lng=-97.7431, radius-km=10, count=25, window-days=90, max-reviews=100
**Tarih:** 2026-07-04

Bu rapor `docs/11-risks-assumptions.md` Bölüm A, Risk 1 için erken sinyal verisidir:
"hedef segmentte rakip başına aylık ortalama yorum hızı" sorusuna cevap arar.

## Özet

| Metrik | Değer |
| --- | --- |
| Klinik sayısı | 25 |
| Medyan yorum/ay | 9.0 |
| p25 yorum/ay | 3.3 |
| p75 yorum/ay | 15.3 |
| Min / Max yorum/ay | 0.3 / 30.3 |
| Sansürlü klinik sayısı | 0 |
| Scrape başarı oranı | 100% (25/25) |
| Parse edilemeyen yorum tarihi sayısı | 0 |

## Kadans kararı için girdiler

- Haftada ≥1 yorum alan klinik oranı (≥4.3 yorum/ay): **72%** (18/25)
- Ayda <2 yorum alan oran: **12%** (3/25)

Medyan düşükse veya "ayda <2 yorum" oranı yüksekse, "haftalık" kadans vaadi
yeniden gözden geçirilmelidir (bkz. Risk 1 panzehiri #2: hacme göre kadans).
Sıfır/başarısız scrape oranı da Risk 3 ("Google veri erişimi zorlaşır") için
bir erken sinyaldir.

## Klinik bazında detay

| Klinik | Toplam yorum (Google) | Pencere içi yorum | Yorum/ay | Puan |
| --- | --- | --- | --- | --- |
| Daylight Dental South Austin | 1079 | 48 | 16.0/ay | 4.8 |
| Austin Emergency Dental | 737 | 61 | 20.3/ay | 4.9 |
| Breeze Dental | 852 | 46 | 15.3/ay | 4.8 |
| Austin Primary Dental | 366 | 9 | 3.0/ay | 4.9 |
| ATX Family Dental | 855 | 58 | 19.3/ay | 4.9 |
| Alta Dental | 267 | 3 | 1.0/ay | 4.9 |
| Swish Dental South | 932 | 57 | 19.0/ay | 4.7 |
| The Tooth Inc | 577 | 36 | 12.0/ay | 5.0 |
| Jefferson Dental & Orthodontics | 665 | 27 | 9.0/ay | 4.1 |
| Access Dental & Orthodontics | 132 | 7 | 2.3/ay | 4.2 |
| Apex Dental | 208 | 1 | 0.3/ay | 4.4 |
| Lady Bird Dental | 444 | 25 | 8.3/ay | 4.9 |
| South Austin Dentist | 162 | 18 | 6.0/ay | 4.9 |
| Brident Dental & Orthodontics | 590 | 91 | 30.3/ay | 4.6 |
| South Austin Dental Associates | 637 | 47 | 15.7/ay | 4.9 |
| South Austin Dental Implant Studio | 349 | 1 | 0.3/ay | 4.8 |
| South Austin Dental | 323 | 22 | 7.3/ay | 5.0 |
| Martin Dental Group Northwest Hills (Formerly Balcones Dental) | 800 | 44 | 14.7/ay | 4.9 |
| 38th Street Dental | 716 | 23 | 7.7/ay | 5.0 |
| Austin City Dental | 653 | 44 | 14.7/ay | 5.0 |
| Shoal Creek Smile Studio | 333 | 31 | 10.3/ay | 4.9 |
| Highland West Dental Care | 316 | 46 | 15.3/ay | 4.9 |
| Smile Haus Medical Parkway | 351 | 10 | 3.3/ay | 4.9 |
| West Lake Hills Dental | 177 | 10 | 3.3/ay | 5.0 |
| Bridgeview Dental | 478 | 23 | 7.7/ay | 4.9 |
