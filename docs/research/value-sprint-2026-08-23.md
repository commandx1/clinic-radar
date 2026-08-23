# Value Sprint — 2026-08-23 (gece çalışması)

> Amaç: "Klinikler mutlaka para ödemek istemeli; her analiz kullanıcıya mutlaka bir şey kazandırmalı."
> Bu dosya araştırma sentezini, alınan kararları ve uygulama ilerlemesini tek yerde tutar. Branch: `feature/value-sprint`.

## 1. Araştırma sentezi

### Pazar (web araştırması, Ağustos 2026)
- **Segment boşluğu doğrulandı.** Birdeye/Podium/Weave/Solutionreach $250–800+/lokasyon, yıllık sözleşme + demo-gated fiyat; tek şubeli klinik onların hedefi değil. Ucuz araçlar ($9–39) sadece "yorum topla". Arada — rakip-kıyaslı yorum zekası + görev — **hiçbir klinik-özel oyuncu yok**.
- **Churn'ün #1 nedeni faturalama güvensizliği** (otomatik yenileme, gizli zam, 60–90 gün iptal bildirimi). #2: okunmayan dashboard / aksiyona dönüşmeyen analitik. #3: lokasyon bazlı fiyatın küçük grupları cezalandırması.
- **Ödemeyi tetikleyen somut özellikler:** AI yorum-yanıt taslağı (zaman kazancı), GBP/profil checklist'i, rakip puan/yorum uyarıları, ROI/gelir dili ("4.0 yıldız altı → hastaların %57'si elemeden geçirmiyor"; +1 yıldız ≈ %5–9 gelir), aynı oturumda "aha".
- **Fiyat:** araştırma giriş $49 / $79 upsell öneriyordu. **Kurucu kararı (2026-08-23): $29'da kalındı** — ölçülen marj (~%85, bkz. `11-risks-assumptions.md` Bölüm C) buna izin veriyor ve lansmanda sıfır sosyal kanıtla "düşünmeden denenebilirlik" fiyat farkından değerli bulundu. $79 ileride çoklu-lokasyon/ajans katmanı olarak saklanıyor; erken kullanıcılar grandfather'lanacak.

### Kod denetimi
- typecheck/lint/test temiz (104 test). Pipeline disiplinli (retry-then-pending, best-effort enrichment).
- **Değer kaçakları:** yorum yanıtı taslağı yok · profil/GBP farkı görevleri yok · görev→sonuç takibi yok · 0 görevli analizde boş ekran · Reviews'ta tema etiketi yok · cron analizlerinde çıktı dili `en` sabit · `SCRAPE_SUCCESS_RATE_ALERT_THRESHOLD` ölü · `review_analysis` tablosu ölü · manuel analiz 300 sn senkron tavan (Vercel Hobby).

## 2. Tez ve tasarım ilkesi
Her analiz döngüsünden sonra kullanıcı:
1. **somut yeni bir şey görmeli** (delta kartı — yeni görev çıkmasa bile),
2. **5 dakikada yapabileceği bir aksiyon almalı** (yanıt taslağı, profil quick-win),
3. **yaptığının işe yaradığını görmeli** (görev sonuç takibi).

Değişmeyen ilkeler: ham yorum metni UI'da gösterilmez; eşikler kodda, promptta değil; kesin tahmin yerine bant; RLS her yerde.

## 3. Uygulama dalgaları

| # | Modül | Durum |
|---|---|---|
| 1A | Yorum Yanıt Asistanı (`POST /api/reviews/:id/reply-draft`, Free 5/ay, Pro sınırsız) | ✅ `f84548a` |
| 1B | "Bu analizde ne değişti" kartı (`analysis_runs.delta`) + 0-görev açıklaması | ✅ `24e968c` |
| 1C | Profil farkı görevleri (`source_type='profile_gap'`: yanıt oranı, web sitesi) | ✅ `d5949f3` + kalibrasyon `95c9824` |
| 2D | Görev sonuç takibi (`tasks.outcome_baseline` / `outcome_latest`) | ✅ `4c503e3` |
| 2E | Tahmini hasta/gelir fırsatı kartı (bantlı, şeffaf formül) | ✅ `00033c7` |
| 3F | Canlı puan + rakip uyarıları → haftalık özet, Trend, Overview | ✅ `d37ff9e` |
| 3G | Cron analiz çıktı dili = `users.preferred_locale` | ✅ `914efbd` |
| 3H | Pro erişim helper'ı (`hasProAccess`: plan + status + period_end) — önceden var olan açık | ✅ `c65f692` |
| 3I | Docs drift (05/launch-checklist provider), scrape alarm wiring | ✅ `914efbd` |

Kod dışı kararlar: ~~fiyat~~ **karara bağlandı: $29 (bkz. yukarıdaki Fiyat maddesi)**; açık kalanlar → Anthropic kredisi / `AI_PROVIDER` seçimi, Vercel plan (300 sn tavanı), concierge testi.

## 4. Gerçek veriyle uçtan uca doğrulama (2026-08-23)

Lokal DB'deki gerçek fixture (Mersin'de bir diş kliniği + 3 gerçek ortodonti rakibi) üzerinde
tam pipeline çalıştırıldı — Apify scrape + Claude Aşama 1/2/3 dahil.

**Sonuç:** 720 yorum çekildi (162 own + 558 rakip), 4/4 tema analizi başarılı, **5 görev üretildi**
(4 `competitive_gap` + 1 `absolute_quality`), 53 `theme_summary` satırı, delta + clinic score
snapshot + 5 bildirim yazıldı. Süre ~257 sn (300 sn Vercel tavanının altında ama payı dar).

**Bulgular:**
1. **Gerçek bug — `service_role`'de `competitors` UPDATE grant'ı yok** (`d16b944` ile düzeltildi).
   Yalnızca yeni canlı-puan kodunu değil, **mevcut Trustpilot domain cache'ini** de cron'da
   kırıyordu: Pro işletmelerde her haftalık döngüde aynı Apify araması boşuna tekrarlanıyordu.
2. **Kalibrasyon — yanıt oranı kuralı fazla katıydı.** Rakip yanıt oranları %100 (169 yorum),
   %0 (143), %0 (25) → ortalama %33, eşiğin (%50) altında kaldığı için görev üretilmedi. Oysa
   klinik 8 yorumun 0'ına yanıt vermiş ve doğrudan rakibi 169 yorumun tamamına yanıt veriyor.
   Kural "referans rakip" dalıyla genişletildi (bkz. `02-business-rules.md` Bölüm D).
3. **Ürün sinyali:** kliniğin resmi Google puanı **4.0**, ama son 365 günün puanı **3.38** —
   canlı puan (Faz 2.7) tam olarak bunu görünür kılmak için var; eski ortalama gerilemeyi gizliyor.
4. **Adaptif pencere doğrulandı:** own tarafında son 90 günde yalnızca 1-2 metinli yorum vardı,
   pencere otomatik 365 güne genişledi ve analiz boş dönmedi (Risk 1 panzehiri gerçek veride çalıştı).

## 5. Çok döngülü doğrulama (7 gerçek analiz koşusu, aynı klinik)

Aynı veri üzerinde art arda 7 gerçek döngü koşuldu (Apify + AI). Amaç: ürünün ikinci, üçüncü,
dördüncü haftada da mantıklı davranıp davranmadığını görmek — tek koşu bunu göstermez.

| Döngü | Sağlayıcı | Yeni görev | Güncellenen | Not |
|---|---|---|---|---|
| 1 | Claude | 5 | 0 | ilk analiz, 720 yorum çekildi |
| 2 | Claude | 5 | 0 | **kusur:** tema etiketi kayması → 5 kopya görev |
| 3 | Claude | 2 | 4 | tema sözlüğü devrede |
| 4 | Claude | — | 1 | Anthropic kredisi bitti → Aşama 2 düştü; profil görevi yine de güncellendi |
| 5 | Gemini | 2 | 4 | yedek sağlayıcı tam pipeline'da çalıştı (110 sn) |
| 6 | Gemini | 1 | 5 | rakip sözlüğüne pin sonrası |
| 7 | Gemini | **0** | 7 | açık görev tavanı devrede |

**Bu koşularda bulunan ve düzeltilen gerçek kusurlar** (hiçbiri birim testiyle yakalanamazdı):
1. `service_role`'de `competitors` UPDATE grant'ı yok (`d16b944`) — canlı puan + **mevcut** Trustpilot cache'i cron'da kırıktı.
2. Yanıt oranı kuralı fazla katı (`95c9824`) — 169/169 yanıt veren rakip varken görev üretmiyordu.
3. Tema etiketi kayması (`c1fe046`, `082311a`) — kopya görevler + sahte "iyileşti" iddiası.
4. Sonuç metriği `competitive_gap` görevlerinde anlamsızdı (`2c29f73`) — artık olumlu bahsedilme izleniyor, sinyal yoksa satır gizleniyor.
5. Açık görev tavanı yoktu (`7559a46`) — 6 döngüde 15 açık görev birikti.
6. Gemini yedek sağlayıcı modeli kapatılmıştı (`fd3f2bf`) — yedek yol tamamen kırıktı, tam da krediler bitince ihtiyaç duyulacakken.

**Süre:** Claude ile 246–270 sn, Gemini ile 110 sn (Vercel 300 sn tavanı — Claude'da pay çok dar).
