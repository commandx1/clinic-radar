# Yorum Hızı Ölçümü — "dental clinic"

**Parametreler:** lat=31.5493, lng=-97.1467, radius-km=10, count=25, window-days=90, max-reviews=100
**Tarih:** 2026-07-04

Bu rapor `docs/11-risks-assumptions.md` Bölüm A, Risk 1 için erken sinyal verisidir:
"hedef segmentte rakip başına aylık ortalama yorum hızı" sorusuna cevap arar.

## Özet

| Metrik | Değer |
| --- | --- |
| Klinik sayısı | 25 |
| Medyan yorum/ay | 5.3 |
| p25 yorum/ay | 1.7 |
| p75 yorum/ay | 14.3 |
| Min / Max yorum/ay | 0.0 / 31.0 |
| Sansürlü klinik sayısı | 0 |
| Scrape başarı oranı | 100% (25/25) |
| Parse edilemeyen yorum tarihi sayısı | 0 |

## Kadans kararı için girdiler

- Haftada ≥1 yorum alan klinik oranı (≥4.3 yorum/ay): **56%** (14/25)
- Ayda <2 yorum alan oran: **28%** (7/25)

Medyan düşükse veya "ayda <2 yorum" oranı yüksekse, "haftalık" kadans vaadi
yeniden gözden geçirilmelidir (bkz. Risk 1 panzehiri #2: hacme göre kadans).
Sıfır/başarısız scrape oranı da Risk 3 ("Google veri erişimi zorlaşır") için
bir erken sinyaldir.

## Klinik bazında detay

| Klinik | Toplam yorum (Google) | Pencere içi yorum | Yorum/ay | Puan |
| --- | --- | --- | --- | --- |
| Central Texas Dental Care | 386 | 8 | 2.7/ay | 4.8 |
| Legends Dental | 545 | 43 | 14.3/ay | 4.8 |
| Aspen Dental - Waco, TX | 1129 | 32 | 10.7/ay | 4.2 |
| Heart of Texas Smiles General & Cosmetic Dentistry | 1724 | 93 | 31.0/ay | 4.9 |
| Stonehaven Dental & Orthodontics - Waco | 1043 | 77 | 25.7/ay | 4.7 |
| Waco Family Dentistry | 1219 | 8 | 2.7/ay | 4.9 |
| Waco Dental | 270 | 11 | 3.7/ay | 4.9 |
| Today's Family Dental | 1237 | 47 | 15.7/ay | 4.9 |
| Premier Family Dental | 277 | 2 | 0.7/ay | 4.8 |
| Dr Smilee Dental of Waco Family, Dental Implant, Emergency Dentistry | 1037 | 32 | 10.7/ay | 4.8 |
| Hillcrest Dental Care - Waco | 364 | 11 | 3.7/ay | 4.7 |
| ACE Dental of Waco | 371 | 15 | 5.0/ay | 4.5 |
| Creekwood Dental Arts | 228 | 4 | 1.3/ay | 4.9 |
| WM Dentistry of Waco | 694 | 44 | 14.7/ay | 5.0 |
| Smiley Dental & Orthodontics | 60 | 5 | 1.7/ay | 4.7 |
| Dental Station Family Dentistry Waco | 15 | 0 | 0.0/ay | 4.4 |
| Fusion Dental & Braces - Hewitt | 307 | 25 | 8.3/ay | 4.6 |
| Rodeo Dental & Orthodontics of Waco | 675 | 72 | 24.0/ay | 4.8 |
| Castle Dental | 125 | 0 | 0.0/ay | 4.5 |
| Lake Shore Dental | 227 | 25 | 8.3/ay | 4.9 |
| Affordable Dentist Near Me of Waco | 580 | 49 | 16.3/ay | 4.6 |
| Smiley Dental & Orthodontics | 32 | 3 | 1.0/ay | 4.8 |
| Brazos Kids Dental | 248 | 33 | 11.0/ay | 4.9 |
| Madison Cooper Community Center | 1 | 0 | 0.0/ay | 5.0 |
| Waco Family Medicine - Central | 187 | 16 | 5.3/ay | 3.1 |
