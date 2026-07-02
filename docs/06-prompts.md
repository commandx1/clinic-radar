# 06 — Prompt Şablonları

Bu dokümandaki şablonlar `05-ai-pipeline.md`'deki Aşama 1 ve Aşama 2 çağrıları içindir. Her ikisi de Claude'dan **sadece JSON** döner, başka hiçbir metin istenmez (parse güvenliği için).

## Ortak kurallar (her iki aşamada da geçerli)
- Claude'un ürettiği her `summary`/`description` alanı **kendi cümleleriyle** yazılmalı — hiçbir yorumdan birebir alıntı yapılmamalı (hem telif hem ürün ilkesi, bkz. `01-product-vision.md`).
- Dil: çıktı dili **parametrik** — `businesses` sahibinin arayüz dili neyse (bkz. `07-ui.md` cihaz dili algılama) o dilde üretilir, prompt'a `output_language` olarak geçirilir. Yorumların kendi dili çıktıyı etkilemez (ör. İngilizce yorum, Türkçe arayüzlü kullanıcı için Türkçe özetlenir).
- Eşik/filtreleme mantığı prompt'ta değil, uygulama kodunda (`02-business-rules.md`) uygulanır — Claude'a "en az 5 mention'ı olanları döndür" gibi kurallar yazdırmak yerine, Claude tüm temaları döndürsün, filtreleme kod tarafında yapılsın (daha test edilebilir, daha az prompt kırılganlığı).

---

## Aşama 1 — Tema/Duygu/Intent Çıkarımı

**Sistem promptu (özet):**
> Sen bir müşteri deneyimi analistisin. Sana bir işletmenin Google Maps yorumları verilecek. Görevin, yorumlardaki tekrar eden temaları, bu temalara dair duygu tonunu ve aciliyetini çıkarmak. Yorumlardan asla birebir alıntı yapma, her zaman kendi cümlelerinle özetle. Sadece belirtilen JSON şemasında yanıt ver.

**Kullanıcı promptu (yapı):**
```
İşletme: {business_name} ({category})
Yorumlar (son 90 gün, {review_count} adet):
{review_list: [{rating, text, language, published_at}, ...]}

Her tekrar eden tema için:
- theme: kısa tema adı (ör. "bekleme süresi", "fiyat şeffaflığı")
- sentiment: positive | negative | mixed
- mention_count: bu temaya değinen yorum sayısı
- summary: kendi cümlelerinle 1 cümlelik özet (asla alıntı değil)
```

**Beklenen çıktı şeması:**
```json
{
  "themes": [
    {
      "theme": "bekleme süresi",
      "sentiment": "negative",
      "mention_count": 14,
      "summary": "Hastalar randevu saatinde uzun bekleme yaşadığını belirtiyor"
    }
  ]
}
```

---

## Aşama 2 — Fark Analizi + Görev Üretimi (Opportunity Scoring dahil)

**Sistem promptu (özet):**
> Sen bir işletme danışmanısın. Sana bir kliniğin ve seçilmiş rakiplerinin tema analizleri verilecek. İki tür fırsatı ayrı ayrı değerlendir: (1) rakiplerin güçlü olduğu ama kliniğin zayıf/eksik olduğu alanlar, (2) kliniğin kendi yorumlarında ciddi ve tekrar eden bir sorun — rakipler de aynı sorunu yaşasa bile bunu atlama. Her görev için etki (impact_score, 0-100), uygulama zorluğu (effort_score, 1-5) ve kaynağını (source_type) belirt. Sadece belirtilen JSON şemasında yanıt ver.

**Kullanıcı promptu (yapı):**
```
Klinik temaları: {own_theme_summary}
Rakip temaları (rakip adı ile birlikte): {competitor_theme_summaries}

Her fırsat için:
- title: eylem odaklı, kısa başlık
- description: neden önemli, ne yapılmalı (2-3 cümle, kendi cümlelerinle)
- source_type: "competitive_gap" (rakip farkı) veya "absolute_quality" (mutlak sorun, rakip farkı olmasa da)
- based_on_competitor: competitive_gap ise hangi rakip(ler)den doğdu; absolute_quality ise null
- theme: ilişkili tema adı
- impact_score: 0-100 (bu iyileştirilirse puan/itibar üzerindeki tahmini etki)
- effort_score: 1-5 (1=kolay/hızlı, 5=zor/uzun soluklu)
```

**Beklenen çıktı şeması:**
```json
{
  "tasks": [
    {
      "title": "Randevu saatlerinde bekleme süresini azalt",
      "description": "3 rakibinizde de 'hızlı randevu' övgüsü var, sizde 14 yorumda bekleme şikayeti var. Randevu aralıklarını artırmayı ya da check-in bildirimi eklemeyi değerlendirin.",
      "source_type": "competitive_gap",
      "based_on_competitor": "Rakip A, Rakip C",
      "theme": "bekleme süresi",
      "impact_score": 82,
      "effort_score": 2
    },
    {
      "title": "Fatura sürecindeki şeffaflık şikayetlerini azalt",
      "description": "Son 90 günde 9 yorumda faturalandırma netliği eleştirilmiş (tüm mention'ların %35'i). Rakiplerde de benzer sorun var ama bu hâlâ hasta memnuniyetini doğrudan etkiliyor.",
      "source_type": "absolute_quality",
      "based_on_competitor": null,
      "theme": "fatura şeffaflığı",
      "impact_score": 65,
      "effort_score": 3
    }
  ]
}
```

`priority` alanı (`high`/`medium`/`low`) kod tarafında `impact_score` ve `effort_score`'dan türetilir — formül `09-task-engine.md`'de.

---

## Aşama 3 (Faz 1.1) — Executive Summary

**Kullanıcı promptu (yapı):**
```
Clinic Score: {score} (geçen ay: {prev_score})
Tamamlanan görevler: {done_count}/{total_count}
Tema trendleri: {theme_summary with trend field}

Tek paragraf, 2-3 cümlelik bir yönetici özeti yaz. Somut bir sayı veya trend referans ver.
```
