# Value Sprint — 2026-08-23 (gece çalışması)

> Amaç: "Klinikler mutlaka para ödemek istemeli; her analiz kullanıcıya mutlaka bir şey kazandırmalı."
> Bu dosya araştırma sentezini, alınan kararları ve uygulama ilerlemesini tek yerde tutar. Branch: `feature/value-sprint`.

## 1. Araştırma sentezi

### Pazar (web araştırması, Ağustos 2026)
- **Segment boşluğu doğrulandı.** Birdeye/Podium/Weave/Solutionreach $250–800+/lokasyon, yıllık sözleşme + demo-gated fiyat; tek şubeli klinik onların hedefi değil. Ucuz araçlar ($9–39) sadece "yorum topla". Arada — rakip-kıyaslı yorum zekası + görev — **hiçbir klinik-özel oyuncu yok**.
- **Churn'ün #1 nedeni faturalama güvensizliği** (otomatik yenileme, gizli zam, 60–90 gün iptal bildirimi). #2: okunmayan dashboard / aksiyona dönüşmeyen analitik. #3: lokasyon bazlı fiyatın küçük grupları cezalandırması.
- **Ödemeyi tetikleyen somut özellikler:** AI yorum-yanıt taslağı (zaman kazancı), GBP/profil checklist'i, rakip puan/yorum uyarıları, ROI/gelir dili ("4.0 yıldız altı → hastaların %57'si elemeden geçirmiyor"; +1 yıldız ≈ %5–9 gelir), aynı oturumda "aha".
- **Fiyat:** $49–79 hipotezi savunulabilir; araştırma **giriş $49, $79 upsell**, aydan aya varsayılan, şeffaf fiyat sayfası öneriyor. Canlı kod şu an **$29** (`pricing-plans.ts`) — doküman ($49–79) ile çelişiyor; LemonSqueezy variant fiyatıyla birlikte ele alınmalı (karar: kurucu).

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
| 1C | Profil farkı görevleri (`source_type='profile_gap'`: yanıt oranı, web sitesi) | ✅ `d5949f3` |
| 2D | Görev sonuç takibi (`tasks.outcome_baseline` / `outcome_latest`) | ✅ `4c503e3` |
| 2E | Tahmini hasta/gelir fırsatı kartı (bantlı, şeffaf formül) | ✅ `00033c7` |
| 3F | Canlı puan + rakip uyarıları → haftalık özet, Trend, Overview | ✅ `d37ff9e` |
| 3G | Cron analiz çıktı dili = `users.preferred_locale` | ✅ `914efbd` |
| 3H | Pro erişim helper'ı (`hasProAccess`: plan + status + period_end) — önceden var olan açık | ✅ `c65f692` |
| 3I | Docs drift (05/launch-checklist provider), scrape alarm wiring | ✅ `914efbd` |

Kod dışı kararlar (kurucuya): fiyat ($29 → $49?) + LemonSqueezy variant; Vercel plan (300 sn tavanı); concierge testi.

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
