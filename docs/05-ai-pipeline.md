# 05 — AI Pipeline

## Tasarım kararı: neden 2 zengin çağrı, 10 mikroservis değil

Klasik NLP mimarisinde (embedding → ayrı theme detection → ayrı intent detection → ...) her aşama ayrı bir model/servis gerektirirdi çünkü hiçbiri "anlamıyordu", sadece pattern eşleştiriyordu. Claude gibi bir LLM ile bu artık geçerli değil: **temizlik, dil tespiti, tema, duygu, intent aynı yapılandırılmış (structured JSON) çağrıda çıkarılabilir.** Bunu 6-8 ayrı mikroservise bölmek, soloyken bakım yükünü büyütür, gecikmeyi artırır ve maliyeti (her aşama ayrı token/API çağrısı) yükseltir, buna karşılık MVP aşamasında ölçülebilir bir kalite kazancı sağlamaz.

**Embedding'e bilinçli olarak MVP'de yer verilmiyor** — embedding'in değeri, binlerce klinik arasında gözetimsiz tema kümeleme veya benzerlik araması yapmak istediğinde ortaya çıkar (Faz 3, "tema taksonomisi" ölçeklenince). Tek bir kliniğin 3-10 rakibinin yorumlarını analiz ederken, Claude'a doğrudan "şu temaları çıkar" demek hem daha ucuz hem daha isabetli.

**Competitor merge ve priority scoring** ayrı mikroservis değil, Aşama 2 çağrısının çıktısının bir parçası (aşağıda).

## Pipeline (uygulanan hali)

```
[Reviews (own + competitors)]
        │
        ▼
┌─────────────────────────────┐
│ Aşama 1: Per-Business        │   → her işletme için ayrı çağrı
│ Theme + Sentiment + Intent    │   Input: o işletmenin yorumları
│ Extraction                    │   Output: review_analysis + theme_summary satırları
└─────────────────────────────┘
        │  (tüm işletmelerin theme_summary'leri toplanır)
        ▼
┌─────────────────────────────┐
│ Aşama 2: Gap Analysis +       │   Input: kendi theme_summary + rakip theme_summary'leri
│ Absolute Quality Check +      │   Output: tasks (impact_score, effort_score,
│ Opportunity Scoring +         │           source_type dahil)
│ Task Generation                │
└─────────────────────────────┘
        │
        ▼
┌─────────────────────────────┐
│ Aşama 3 (Faz 1.1): Executive │   Input: Clinic Score, task listesi, trend
│ Summary                       │   Output: dashboard'daki tek paragraflık özet
└─────────────────────────────┘
```

## Aşama 1 detayı
- **Ne zaman çalışır:** yeni yorum çekildiğinde (ilk analiz + haftalık/aylık yenileme).
- **Input:** bir işletmenin (own ya da bir competitor) son 90 günlük yorumları, ham metin + puan + dil.
- **Dil tespiti ve temizlik:** aynı çağrının içinde, prompt'ta talep edilir — ayrı adım değil.
- **Output şeması:** `06-prompts.md`'de tanımlı, `review_analysis` (yorum bazlı) ve `theme_summary` (toplulaştırılmış) tablolarına yazılır.
- **Negatif/pozitif mention eşiği** (`02-business-rules.md` Bölüm D) burada değil, Aşama 2'de görev filtrelemesinde uygulanır.

## Aşama 2 detayı
- **Ne zaman çalışır:** Aşama 1 tüm seçili işletmeler için tamamlandıktan sonra.
- **Input:** kullanıcının theme_summary'si + tüm rakiplerin theme_summary'leri (birleştirilmiş).
- **Mantık:** iki paralel kontrol yapılır (`02-business-rules.md` Bölüm D):
  1. **Rekabetçi fark:** rakip(ler)in güçlü olduğu ama kullanıcının zayıf/eksik olduğu temaları bul.
  2. **Mutlak kalite sorunu:** rakip karşılaştırmasından bağımsız olarak, kullanıcının kendi yorumlarında negatif mention oranı eşiği aşan temaları bul (rakipler de aynı sorunu yaşasa bile).
  Her iki kaynaktan çıkan fırsat için impact_score ve effort_score üret → eşiklere göre filtrele → görev metnini yaz, `source_type`'ı işaretle.
- **Output:** `tasks` tablosuna yazılan, kullanıcı arayüzünde gösterilecek nihai görevler.

## Aşama 3 (Faz 1.1)
Dashboard'daki executive özet paragrafını üretir ("Bekleme süresi şikayetleri üç aydır düşüyor, bu olumlu bir trend" gibi). `clinic_score_history` ve `theme_summary.trend` alanlarını input alır.

## Hata toleransı
- Claude'un JSON çıktısı şema doğrulamasından geçmezse (örn. eksik alan): tek retry, hâlâ başarısızsa o işletme için analiz "pending" olarak işaretlenir, kullanıcıya "analiz devam ediyor" gösterilir — sessizce yarım veri gösterilmez.
