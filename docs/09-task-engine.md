# 09 — Task Engine & Opportunity Score

Bu doküman, ürünün "wow" özelliğinin (Opportunity Score) ve görev yaşam döngüsünün algoritmik detayını içerir. `02-business-rules.md`'deki kurallar burada formüle dökülür.

## Opportunity Score bileşenleri

Her görev iki skorla değerlendirilir:
- **impact_score** (0-100): Artık Aşama 2 Claude çağrısından ALINMAZ — `src/lib/task-engine/impact-score.ts` içinde kod tarafında, rakip yaygınlığı + own eksikliği + trend kırılımından deterministik hesaplanır (bkz. "Impact score bileşenleri (v1)" altbölümü).
- **effort_score** (1-5): uygulama zorluğu. Aşama 2 Claude çağrısından (`06-prompts.md`) gelir. 1 = hızlı/kolay (ör. "Google profiline fotoğraf ekle"), 5 = zor/uzun soluklu (ör. "randevu sistemini değiştir").

### Impact score bileşenleri (v1)

İki aday tipi (`candidate_source_type`) için farklı formül kullanılır:

**`competitive_gap`** (rakip bu temada güçlü, klinik zayıf/eksik):
```
competitor_prevalence = rakibin bu temadaki pozitif mention oranı × 100   (0-100)
own_deficiency        = (1 - kliniğin bu temadaki pozitif mention oranı) × 100
                         (own bu temada hiç veri üretmediyse tam eksiklik = 100)
trend_adjustment      = own tema trend'ine göre +IMPACT_SCORE_TREND_WORSENING_BONUS /
                         IMPACT_SCORE_TREND_IMPROVING_PENALTY / 0

impact_score = clamp(
    competitor_prevalence * IMPACT_SCORE_COMPETITOR_PREVALENCE_WEIGHT +
    own_deficiency        * IMPACT_SCORE_OWN_DEFICIENCY_WEIGHT +
    trend_adjustment,
  0, 100)
```

**`absolute_quality`** (rakip fark etmeksizin kliniğin kendi ciddi/tekrar eden sorunu — rakip verisi bu tipte anlamsız, `competitor_prevalence = null`):
```
own_deficiency   = kliniğin bu temadaki negatif mention oranı × 100
                   — severity='critical' ise oran hesaplanmaz, sabit 100 kabul edilir
                     (bkz. 02-business-rules.md Bölüm D "kritik tekil yorum sinyali";
                     tek ciddi yorum etraftaki olumlu yorumlarla sulandırılmamalı)
volume           = clamp((negatif mention sayısı / IMPACT_SCORE_MENTION_VOLUME_SCALE) * 100, 0, 100)
trend_adjustment = (yukarıdaki ile aynı mantık)

impact_score = clamp(
    own_deficiency * IMPACT_SCORE_ABSOLUTE_QUALITY_DEFICIENCY_WEIGHT +
    volume         * IMPACT_SCORE_ABSOLUTE_QUALITY_VOLUME_WEIGHT +
    trend_adjustment,
  0, 100)
```

Ağırlık/eşik sabitleri `src/lib/constants.ts` içinde tek yerde tutulur (`IMPACT_SCORE_*`, `IMPACT_SCORE_MENTION_VOLUME_SCALE`) — kalibrasyon için buradan değiştirilir. Görev kartında "neden bu skor" kırılımını göstermek için `ImpactScoreBreakdown` (competitor_prevalence, own_deficiency, trend, trend_adjustment) ham bileşenleriyle birlikte döndürülür ve saklanır (`tasks.impact_score_breakdown`).

## Priority türetme (kod tarafında, promptta değil)
```
priority_raw = impact_score / effort_score

if priority_raw >= 30  → priority = "high"
if priority_raw >= 12  → priority = "medium"
else                    → priority = "low"
```
Bu eşikler ilk 20-30 gerçek görev üzerinde kalibre edilmeli — başlangıç değerleri olarak kullanılsın.

## Görev yeniden önceliklendirme (14 gün kuralı)
Bir görev 14 gün `open` kalırsa:
1. İlgili temanın en güncel `theme_summary.trend` değerine bakılır.
2. `worsening` → impact_score +10 (üst sınır 100).
3. `improving` → impact_score -15 (kullanıcı muhtemelen zaten bir şey yapıyor, öncelik düşer).
4. `stable` → değişmez.
5. Yeni `priority_raw` hesaplanır, `priority` güncellenir, `last_priority_recalc_at` yazılır.

## Otomatik dismiss (60 gün kuralı)
Görev 60 gün `open` kalır ve `priority = low` ise → `status = dismissed`, kullanıcıya bildirim (`02-business-rules.md` Bölüm G).

## Dismissed görev reopen (2x negatif patlama kuralı)
Bu kontrol analiz döngüsü içinde (`analysis/run` route'u) tema özeti (`theme_summary`) kaydından sonra, görev upsert'inden önce çalışır — bkz. `02-business-rules.md` Bölüm E.

## Clinic Score formülü (ilk versiyon, kalibre edilecek)
```
clinic_score =
    0.4 * (own_rating / 5 * 100) +
    0.3 * task_completion_rate * 100 +
    0.3 * review_growth_trend_normalized
```
- `task_completion_rate`: son 90 gündeki done/toplam oranı.
- `review_growth_trend_normalized`: son 90 gün yorum artış hızının rakip ortalamasına göre normalize edilmiş hali (0-100 aralığına sıkıştırılır).

Bu formül **v1 tahminidir** — gerçek kullanıcı verisiyle (özellikle hangi görev tiplerinin gerçekten rating'i etkilediği görüldükçe) ağırlıklar revize edilmeli. Formülün kod içinde tek bir yerde (config) tutulması, A/B test edilebilmesi için önemli.

## Potential Rating Gain (Executive kart için)
```
potential_rating_gain = sum(impact_score of open tasks with priority='high') / 1000
```
Kaba bir tahmin katsayısıdır (1000 sabiti kalibrasyon gerektirir), amaç kesin bir bilimsel tahmin değil, kullanıcıya "bunu yaparsan işe yarar" hissi vermek.
