# 10 — Roadmap & Başarı Metrikleri

> Riskler, kill-risk erken sinyalleri ve "haftalık görev" varsayımının test planı için: `11-risks-assumptions.md`. Oradaki Bölüm E aksiyon listesi bu roadmap'in üstünde önceliklidir — ürünü öldürebilecek varsayımlar doğrulanmadan feature sırası tartışılmaz.

## Faz 1 — MVP (4-6 hafta hedef)
- [x] Kayıt/giriş, işletme bağlama
- [x] Otomatik rakip keşfi (`02-business-rules.md` Bölüm B kuralları)
- [x] Checkbox ile rakip seçimi
- [x] Yorum çekme (Apify) — own + seçilen rakipler
- [x] Aşama 1 + Aşama 2 AI pipeline (`05-ai-pipeline.md`)
- [x] Görev listesi + Opportunity Score (`09-task-engine.md`)
- [x] Dashboard: Overview (executive kart), Tasks, Competitors, Reviews, Themes, Trend (`08-dashboard.md`)
- [x] Arayüz i18n — cihaz diline göre otomatik dil seçimi (tr/en, `07-ui.md`)
- [x] Free plan (limitler `02-business-rules.md` Bölüm A)

**Kapsam dışı (bilinçli):** otomatik yorum isteme/SMS, çok dilli **yorum** analizi (yabancı dildeki yorumların çevirisi/analizi), doktor/tedavi kırılımı, ajans paneli.

## Faz 1.1
- Haftalık otomatik yeniden analiz (Pro plan)
- E-posta özet bildirimi — **not:** sadece bildirim değil, potansiyel ana teslimat kanalı; ağırlığı concierge test sonucuna göre belirlenir (`11-risks-assumptions.md` Bölüm D)
- [x] Executive Summary (Aşama 3, `05-ai-pipeline.md`) — dashboard Overview'de iki dilli ({tr,en}) özet kartı; `clinic_score_history.executive_summary`'ye yazılır, tema trendleri (`theme_summary.trend`) artık kod tarafında hesaplanıyor
- [x] Task history görünümü (şema zaten hazır, sadece UI) — `/business/tasks/history`, Tasks sayfasıyla karşılıklı linkli alt-görünüm
- Bildirim kuralları (`02-business-rules.md` Bölüm G)
- [x] Döngüler arası "sessizlik" hissini azaltacak dashboard göstergeleri — az sayıda görev (Bölüm D eşikleri) + Free planda ayda 1 döngü (Bölüm A) birleşince kullanıcı analizler arası uygulamayı "çalışmıyor" sanabilir. İlk adım: Overview'de bir sonraki analizin ne zaman açılacağını proaktif göster (hata bekletmeden, cooldown süresince her ziyarette görünür).
- [x] `dismissed` görevlerin 2x mention patlamasında otomatik yeniden `open` olması (Bölüm E, `09-task-engine.md`) — kod tarafında implemente edildi. Sonraki adım (henüz yapılmadı): haftalık özet e-postası (yukarıdaki madde) üzerinden bu sinyalin kullanıcıya taşınması.

## Faz 1.2 — Görev kalitesi (kanıt → içgörü → iş)
- [x] Görev kartında kanıt satırı — own vs rakip mention kıyası, `theme_summary`'den kod tarafında hesaplanır, AI'a güvenilmez. Tema eşleşmezse satır gizlenir.
- [x] Görev başlığı kuralı — soyut hedef değil doğal eylem cümlesi; sağlık reklam mevzuatına aykırı öneri üretilmez (before/after fotoğraf, teşvikli yorum vb.) — prompt kuralı, `06-prompts.md`.
- [ ] Checklist alt adımlar + tamamlanma kriterleri — `tasks.checklist_i18n jsonb` (migration), Aşama 2 çıktısına 3-5 somut alt adım, UI'da tiklenebilir; north star'ı (tamamlanan görev) doğrudan besler.
- [ ] Impact score'un kod tarafında bileşenlerden hesaplanması — rakip yaygınlığı + trend + own eksikliği kırılımı; skor AI'dan alınmaz, karta "neden bu skor" kırılımı gösterilir (`09-task-engine.md` ile senkron güncellenecek).
- [ ] Rakip bazlı tema saklama — `theme_summary`'ye rakip kimliği (veya yeni tablo, `03-database.md` güncellemesi gerekir); görev kartında "bu görev neden oluştu" rakip bölümü ("5 rakibinden 4'ünde güçlü" vb.). Ham yorum alıntısı yasağı geçerli kalır.

Not: tahmini etki gösterimi bantlı olacak (`potential-rating-gain` düşük/orta/yüksek), asla "+0.18 yıldız" gibi kesin tahmin verilmez — uydurulmuş hassasiyet güveni yıkar.

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
