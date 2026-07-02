# 10 — Roadmap & Başarı Metrikleri

## Faz 1 — MVP (4-6 hafta hedef)
- [ ] Kayıt/giriş, işletme bağlama
- [ ] Otomatik rakip keşfi (`02-business-rules.md` Bölüm B kuralları)
- [ ] Checkbox ile rakip seçimi
- [ ] Yorum çekme (Apify) — own + seçilen rakipler
- [ ] Aşama 1 + Aşama 2 AI pipeline (`05-ai-pipeline.md`)
- [ ] Görev listesi + Opportunity Score (`09-task-engine.md`)
- [ ] Dashboard: Overview (executive kart), Tasks, Competitors, Themes, Trend (`08-dashboard.md`)
- [x] Arayüz i18n — cihaz diline göre otomatik dil seçimi (tr/en, `07-ui.md`)
- [ ] Free plan (limitler `02-business-rules.md` Bölüm A)

**Kapsam dışı (bilinçli):** otomatik yorum isteme/SMS, çok dilli **yorum** analizi (yabancı dildeki yorumların çevirisi/analizi), doktor/tedavi kırılımı, ajans paneli.

## Faz 1.1
- Haftalık otomatik yeniden analiz (Pro plan)
- E-posta özet bildirimi
- Executive Summary (Aşama 3, `05-ai-pipeline.md`)
- Task history görünümü (şema zaten hazır, sadece UI)
- Bildirim kuralları (`02-business-rules.md` Bölüm G)

## Faz 2
- Karışık dilli yorum kırılımı — turistik/uluslararası hasta çeken klinikler için yorumları dil/köken bazında ayrıştırma (herhangi bir ülkede uygulanabilir, tek bir ülkeye özel bir senaryo değil)
- Ajans / white-label paneli (çoklu işletme yönetimi)
- Doctor Analysis, Treatments sekmeleri (`08-dashboard.md`)
- Monthly Report (PDF export)
- Akıllı rakip önerisi (fiyat segmenti, tedavi türü benzerliği — şu an kullanıcı checkbox ile seçtiği için ertelendi)

## Faz 3
- AI arama görünürlüğü modülü (ChatGPT/Gemini/Perplexity'de klinik nasıl öneriliyor)
- Tema taksonomisi ölçeklenirse embedding/clustering katmanı (`05-ai-pipeline.md`'deki gerekçeye bkz.)

## Başarı metrikleri

**Kuzey yıldızı:** haftalık tamamlanan görev sayısı / kullanıcı (`01-product-vision.md`).

| Metrik | Neden önemli |
|---|---|
| Onboarding tamamlama oranı (kayıt → ilk görev listesi) | Aktivasyon darboğazını gösterir |
| Haftalık aktif kullanıcı / görev tamamlama oranı | Asıl retention sinyali |
| Free → Pro dönüşüm oranı | Monetizasyon sağlığı |
| Ortalama görev tamamlama süresi | Kullanıcı gerçekten aksiyon alıyor mu |
| Clinic Score trendi (kullanıcı bazında, zaman içinde) | Ürünün gerçekten sonuç üretip üretmediği — uzun vadeli en kritik metrik |
