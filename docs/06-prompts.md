# 06 — Prompt Şablonları

Bu dokümandaki şablonlar `05-ai-pipeline.md`'deki Aşama 1 ve Aşama 2 çağrıları içindir. Her ikisi de Claude'dan **sadece JSON** döner, başka hiçbir metin istenmez (parse güvenliği için).

## Ortak kurallar (her iki aşamada da geçerli)
- Claude'un ürettiği her `summary`/`description` alanı **kendi cümleleriyle** yazılmalı — hiçbir yorumdan birebir alıntı yapılmamalı (hem telif hem ürün ilkesi, bkz. `01-product-vision.md`).
- Dil: çıktı dili **parametrik** — `businesses` sahibinin arayüz dili neyse (bkz. `07-ui.md` cihaz dili algılama) o dilde üretilir, prompt'a `output_language` olarak geçirilir. Yorumların kendi dili çıktıyı etkilemez (ör. İngilizce yorum, Türkçe arayüzlü kullanıcı için Türkçe özetlenir). **İstisna:** bu kural sadece Aşama 1'in `theme_summary` çıktısı için geçerlidir — Aşama 2'nin `title`/`description` alanları `output_language`'dan bağımsız, her zaman hem `tr` hem `en` olarak üretilir (bkz. aşağıdaki Aşama 2 bölümü). Sebep: task'lar arayüz locale'i sonradan değiştirilse bile doğru dilde görünmeli, retranslation akışına gerek kalmasın.
- Eşik/filtreleme mantığı prompt'ta değil, uygulama kodunda (`02-business-rules.md`) uygulanır — Claude'a "en az 5 mention'ı olanları döndür" gibi kurallar yazdırmak yerine, Claude tüm temaları döndürsün, filtreleme kod tarafında yapılsın (daha test edilebilir, daha az prompt kırılganlığı).

---

## Aşama 1 — Tema/Duygu/Intent Çıkarımı

**Sistem promptu (özet):**
> Sen bir müşteri deneyimi analistisin. Sana bir işletmenin Google Maps yorumları verilecek. Görevin, yorumlardaki tekrar eden temaları, bu temalara dair duygu tonunu ve aciliyetini çıkarmak. Yorumlardan asla birebir alıntı yapma, her zaman kendi cümlelerinle özetle. Sadece belirtilen JSON şemasında yanıt ver.

**Not (Faz 2):** Sistem promptuna bir kural daha eklendi — her tema belirli bir tedavi/hizmet türüyle (implant, ortodonti, botoks, dolgu vb. — işletme kategorisine göre değişir, kapalı bir liste yok) ilgiliyse bunu `treatment` alanında belirt; tema genel bir konuyla ilgiliyse (bekleme süresi, resepsiyon nezaketi, fiyat şeffaflığı vb.) `treatment`'ı null bırak, bir tedavi türü uydurma.

**Not (kritik tekil yorum sinyali):** Sistem promptuna bir kural daha eklendi — bir temaya değinen yorumlardan EN AZ BİRİ sağlık/güvenlik zararı, ciddi bir etik/yasal risk ya da dolandırıcılık iddiası içeriyorsa `severity` alanını `critical` yap (kaç yorumun aynı şeyi söylediğinden bağımsız — tek yorum yeter); sıradan bir memnuniyetsizlik için `normal` kullan, gürültü yaratmamak için `critical`'ı yalnızca gerçekten ciddi durumlarda kullan. `02-business-rules.md` Bölüm D'deki mention eşiği own tarafında `critical` temalar için atlanır.

**Not (adaptif pencere):** `{window_days}` sabit 90 değil — own tarafında son 90 günde yeterli metinli yorum yoksa (`02-business-rules.md` Bölüm C) 180/365'e genişleyen gerçek pencere değeridir; own+rakip için aynı çağrı döngüsünde aynı değer kullanılır.

**Kullanıcı promptu (yapı):**
```
İşletme: {business_name} ({category})
Yorumlar (son {window_days} gün, {review_count} adet):
{review_list: [{rating, text, language, published_at}, ...]}

Her tekrar eden tema için:
- theme: kısa tema adı (ör. "bekleme süresi", "fiyat şeffaflığı")
- sentiment: positive | negative | mixed
- mention_count: bu temaya değinen yorum sayısı
- summary: kendi cümlelerinle 1 cümlelik özet (asla alıntı değil)
- treatment: ilgili tedavi/hizmet türü (ör. "implant", "ortodonti") ya da null
- severity: normal | critical (sağlık/güvenlik zararı, ciddi etik/yasal risk ya da dolandırıcılık iddiası içeren EN AZ BİR yorum varsa critical, aksi halde normal)
```

**Beklenen çıktı şeması:**
```json
{
  "themes": [
    {
      "theme": "bekleme süresi",
      "sentiment": "negative",
      "mention_count": 14,
      "summary": "Hastalar randevu saatinde uzun bekleme yaşadığını belirtiyor",
      "treatment": null,
      "severity": "normal"
    }
  ]
}
```

---

## Aşama 2 — Fark Analizi + Görev Üretimi (Opportunity Scoring dahil)

**Sistem promptu (özet):**
> Sen bir işletme danışmanısın. Sana bir kliniğin ve seçilmiş rakiplerinin tema analizleri verilecek. İki tür fırsatı ayrı ayrı değerlendir: (1) rakiplerin güçlü olduğu ama kliniğin zayıf/eksik olduğu alanlar, (2) kliniğin kendi yorumlarında ciddi ve tekrar eden bir sorun — rakipler de aynı sorunu yaşasa bile bunu atlama. Her görev için etki (impact_score, 0-100), uygulama zorluğu (effort_score, 1-5) ve kaynağını (source_type) belirt. `title` ve `description` alanlarını hem `tr` hem `en` anahtarıyla, iki dilde de yaz. Sadece belirtilen JSON şemasında yanıt ver.

**Not (Faz 1.2):** Sistem promptuna iki kural eklendi (`gap-analysis-schema.ts` `buildStage2SystemPrompt`) — (1) `title` doğal/somut bir eylem cümlesi olmalı, soyut isim tamlaması değil (iyi: "Hastalara tedavi sürecini daha ayrıntılı anlat", kaçınılacak: "Şeffaf Bilgilendirme Süreçleri Oluştur"); (2) öneriler sağlık sektörü reklam/pazarlama mevzuatına aykırı olamaz (before/after fotoğraf, teşvikli/ücretli yorum, hasta referansı pazarlaması yasak — sadece operasyonel/iletişimsel öneriler).

**Not (coverage kuralı):** Sistem promptuna, yukarıdaki Ortak kurallar'daki "filtreleme kod tarafında" ilkesinin Aşama 2 karşılığı eklendi: model bulduğu **tüm** anlamlı fırsatları aday olarak döndürür, önem/emin-olma elemesini kendi içinde yapmaz (tema başına en fazla bir aday). Eşik (`TASK_MENTION_THRESHOLD`), dedup ve döngü başına 5 görev limiti zaten uygulama kodunda uygulandığı için modelin cömert davranması UI'a gürültü sızdırmaz — aksine az aday üretmesi, kod tarafındaki önceliklendirmenin seçim havuzunu daraltıyordu (2026-07 gözlemi: 55 tema → 2 aday).

**Kullanıcı promptu (yapı):**
```
Klinik temaları: {own_theme_summary}
Rakip temaları: {competitor_theme_summaries} — her rakip {id, name, themes} olarak geçilir (competitive_gap görevlerinin gerçek bir rakip ID'sine bağlanabilmesi için)

Her fırsat için:
- title: eylem odaklı, kısa başlık — hem tr hem en olarak {tr, en} şeklinde
- description: neden önemli, ne yapılmalı (2-3 cümle, kendi cümlelerinle) — hem tr hem en olarak {tr, en} şeklinde
- source_type: "competitive_gap" (rakip farkı) veya "absolute_quality" (mutlak sorun, rakip farkı olmasa da)
- based_on_competitor_id: competitive_gap ise yukarıda geçilen rakip listesindeki id'lerden biri; absolute_quality ise null
- theme: ilişkili tema adı
- impact_score: 0-100 (bu iyileştirilirse puan/itibar üzerindeki tahmini etki)
- effort_score: 1-5 (1=kolay/hızlı, 5=zor/uzun soluklu)
```

**Beklenen çıktı şeması:**
```json
{
  "tasks": [
    {
      "title": { "tr": "Randevu saatlerinde bekleme süresini azalt", "en": "Reduce appointment wait times" },
      "description": {
        "tr": "3 rakibinizde de 'hızlı randevu' övgüsü var, sizde 14 yorumda bekleme şikayeti var. Randevu aralıklarını artırmayı ya da check-in bildirimi eklemeyi değerlendirin.",
        "en": "All 3 competitors are praised for fast appointments, while you have 14 reviews complaining about wait times. Consider spacing out appointment slots or adding check-in notifications."
      },
      "source_type": "competitive_gap",
      "based_on_competitor_id": "3f9c1e2a-...-uuid",
      "theme": "bekleme süresi",
      "impact_score": 82,
      "effort_score": 2
    },
    {
      "title": { "tr": "Fatura sürecindeki şeffaflık şikayetlerini azalt", "en": "Reduce billing transparency complaints" },
      "description": {
        "tr": "Son 90 günde 9 yorumda faturalandırma netliği eleştirilmiş (tüm mention'ların %35'i). Rakiplerde de benzer sorun var ama bu hâlâ hasta memnuniyetini doğrudan etkiliyor.",
        "en": "In the last 90 days, 9 reviews criticized billing clarity (35% of all mentions). Competitors share this issue too, but it still directly affects patient satisfaction."
      },
      "source_type": "absolute_quality",
      "based_on_competitor_id": null,
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

**Sistem promptu (özet):**
> Sen bir işletme analistisin. Sana bir kliniğin skor, görev ve tema trend verileri verilecek. 2-3 cümlelik, tek paragraflık bir yönetici özeti yaz; en az bir somut sayı veya trend referans ver. Yorumlardan asla birebir alıntı yapma. Önceki skor verilmediyse (ilk analiz) geçmiş bir değer uydurma. Özeti hem `tr` hem `en` olarak yaz. Sadece belirtilen JSON şemasında yanıt ver.

**Kullanıcı promptu (yapı):**
```
Clinic Score: {score} (geçen ay: {prev_score} — ilk analizde "ilk analiz")
Tamamlanan görevler: {done_count}/{total_count}
Tema trendleri: {theme_summary with trend field}

Tek paragraf, 2-3 cümlelik bir yönetici özeti yaz. Somut bir sayı veya trend referans ver.
```

**Beklenen çıktı şeması:**
```json
{
  "summary": {
    "tr": "Clinic Score'unuz 68'den 74'e yükseldi; bekleme süresi şikayetleri düşüş trendinde. Açık 5 görevin 3'ünü tamamlamanız bu ivmeyi destekliyor.",
    "en": "Your Clinic Score rose from 68 to 74, with wait-time complaints trending down. Completing 3 of your 5 open tasks is supporting this momentum."
  }
}
```

`title`/`description`'daki iki dilli üretim gerekçesi burada da geçerli: özet `output_language`'dan bağımsız her zaman `{tr, en}` üretilir ve `clinic_score_history.executive_summary`'ye yazılır.
