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
| 1C | Profil farkı görevleri (`source_type='profile_gap'`: yanıt oranı, web sitesi) | ⏳ |
| 2D | Görev sonuç takibi (`tasks.outcome_baseline` / `outcome_latest`) | ⏳ |
| 2E | Tahmini hasta/gelir fırsatı kartı (bantlı, şeffaf formül) | ⏳ |
| 3F | Rakip uyarıları (puan değişimi, yorum patlaması) → haftalık özet | ⏳ |
| 3G | Cron analiz çıktı dili = `users.preferred_locale` | ⏳ |
| 3H | Pro erişim helper'ı (`hasProAccess`: plan + status + period_end) — önceden var olan açık | ⏳ |
| 3I | Docs drift (05/launch-checklist provider), scrape alarm wiring | ⏳ |

Kod dışı kararlar (kurucuya): fiyat ($29 → $49?) + LemonSqueezy variant; Vercel plan (300 sn tavanı); concierge testi.
