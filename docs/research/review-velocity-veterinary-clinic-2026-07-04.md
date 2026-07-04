# Yorum Hızı Ölçümü — "veterinary clinic"

**Parametreler:** lat=30.2672, lng=-97.7431, radius-km=10, count=25, window-days=90, max-reviews=100
**Tarih:** 2026-07-04

Bu rapor `docs/11-risks-assumptions.md` Bölüm A, Risk 1 için erken sinyal verisidir:
"hedef segmentte rakip başına aylık ortalama yorum hızı" sorusuna cevap arar.

## Özet

| Metrik | Değer |
| --- | --- |
| Klinik sayısı | 25 |
| Medyan yorum/ay | 5.0 |
| p25 yorum/ay | 2.3 |
| p75 yorum/ay | 11.3 |
| Min / Max yorum/ay | 1.0 / 29.3 |
| Sansürlü klinik sayısı | 0 |
| Scrape başarı oranı | 100% (25/25) |
| Parse edilemeyen yorum tarihi sayısı | 0 |

## Kadans kararı için girdiler

- Haftada ≥1 yorum alan klinik oranı (≥4.3 yorum/ay): **64%** (16/25)
- Ayda <2 yorum alan oran: **16%** (4/25)

Medyan düşükse veya "ayda <2 yorum" oranı yüksekse, "haftalık" kadans vaadi
yeniden gözden geçirilmelidir (bkz. Risk 1 panzehiri #2: hacme göre kadans).
Sıfır/başarısız scrape oranı da Risk 3 ("Google veri erişimi zorlaşır") için
bir erken sinyaldir.

## Klinik bazında detay

| Klinik | Toplam yorum (Google) | Pencere içi yorum | Yorum/ay | Puan |
| --- | --- | --- | --- | --- |
| Central Texas Veterinary Speciality and Emergency Hospital | 1413 | 21 | 7.0/ay | 4.0 |
| Honnas Veterinary | 880 | 18 | 6.0/ay | 4.9 |
| Travis Country Veterinary Hospital | 587 | 30 | 10.0/ay | 4.9 |
| Parker Animal Care | 830 | 82 | 27.3/ay | 4.6 |
| Capital Veterinary Clinic | 431 | 7 | 2.3/ay | 4.5 |
| VEG ER for Pets | 1030 | 88 | 29.3/ay | 4.7 |
| Modern Animal South Lamar | 169 | 13 | 4.3/ay | 4.8 |
| PAZ Veterinary South | 504 | 15 | 5.0/ay | 4.6 |
| South Congress Veterinary | 196 | 4 | 1.3/ay | 4.7 |
| Thrive Pet Healthcare - South Lamar | 637 | 34 | 11.3/ay | 4.2 |
| Westgate Pet & Bird Hospital | 1084 | 40 | 13.3/ay | 4.7 |
| Moontower Veterinary Surgery Center | 257 | 9 | 3.0/ay | 4.7 |
| Pet and Bird Clinic | 522 | 15 | 5.0/ay | 4.2 |
| Pet Specialists of Austin | 504 | 42 | 14.0/ay | 4.0 |
| Austin Urban Veterinary Center | 516 | 8 | 2.7/ay | 4.9 |
| Highland's Pet Medical Clinic | 164 | 3 | 1.0/ay | 4.8 |
| Northwest Veterinary Hospital | 325 | 3 | 1.0/ay | 4.8 |
| North Austin Animal Hospital | 629 | 14 | 4.7/ay | 4.8 |
| Westlake Animal Hospital, A Thrive Pet Healthcare Partner | 307 | 31 | 10.3/ay | 4.8 |
| Far West Veterinary Clinic | 209 | 6 | 2.0/ay | 4.7 |
| Livewell Animal Hospital of Austin | 401 | 62 | 20.7/ay | 4.9 |
| Austin Pet & Exotic Hospital | 493 | 47 | 15.7/ay | 4.6 |
| PAZ Veterinary West | 125 | 6 | 2.0/ay | 4.9 |
| West Lynn Veterinary Clinic | 205 | 4 | 1.3/ay | 4.7 |
| CityVet | Central Austin | 154 | 13 | 4.3/ay | 5.0 |
