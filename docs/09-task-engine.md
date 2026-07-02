# 09 — Task Engine & Opportunity Score

Bu doküman, ürünün "wow" özelliğinin (Opportunity Score) ve görev yaşam döngüsünün algoritmik detayını içerir. `02-business-rules.md`'deki kurallar burada formüle dökülür.

## Opportunity Score bileşenleri

Her görev, Aşama 2 Claude çağrısından (`06-prompts.md`) iki ham skorla gelir:
- **impact_score** (0-100): iyileştirilirse puan/itibar üzerindeki tahmini etki. Claude bunu mention_count, sentiment yoğunluğu ve rakip sayısındaki tutarlılığa göre tahmin eder.
- **effort_score** (1-5): uygulama zorluğu. 1 = hızlı/kolay (ör. "Google profiline fotoğraf ekle"), 5 = zor/uzun soluklu (ör. "randevu sistemini değiştir").

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
