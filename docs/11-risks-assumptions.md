# 11 — Riskler, Varsayımlar ve Savunma Hattı

> Amaç: ürünü 12 ay içinde öldürebilecek riskleri, her birinin **ölçülebilir erken sinyalini** ve panzehirini tek yerde tutmak. Bu doküman bir "korku listesi" değil, izleme + aksiyon planıdır. Her risk için erken sinyal metriği ilk günden loglanmalıdır — sinyal yoksa risk yönetilemez.

## A. Ölüm riskleri (kill risks)

### Risk 1 — Kullanıcı ilk analizden sonra geri dönmez (en büyük risk)

**Kök neden (kritik nüans):** Bu bir "retention özelliği eksikliği" problemi değil, **veri yenilenme hızı** problemi. Haftalık "yeni içerik" üretebilmek, rakiplerin o hafta yeni yorum almasına bağlı. Tek şubeli klinik + 3-10 rakip evreninde haftalık yeni yorum sayısı düşük olabilir; yeni sinyal yoksa görevler tekrar eder ve kullanıcı "bunu zaten görmüştüm" der.

**Erken sinyaller (ölçülebilir):**
- **MVP öncesi ölçülebilir:** hedef segmentte rakip başına aylık ortalama yorum hızı — Apify ile 20-30 gerçek klinik örnekleyerek ölç. Medyan düşükse "haftalık" kadans vaadi baştan yanlıştır.
  - **ÖLÇÜLDÜ (2026-07-04, Austin "dental clinic", n=25):** medyan **9.0 yorum/ay**, p25=3.3, p75=15.3; kliniklerin **%72**'si haftada ≥1 yorum alıyor (≥4.3/ay), yalnızca %12'si ayda <2 yorumda. Scrape başarı %100. → Büyük metro + dental için "haftalık" kadans vaadi **doğrulandı**; panzehir #2 (hacme göre kadans) %12'lik düşük hacimli kuyruk için hâlâ gerekli ama edge case. Detay: `docs/research/review-velocity-dental-clinic-2026-07-04.md`.
  - **Açık soru (tek pazar, n=1 şehir):** küçük/orta şehir (Waco) ve vertical kontrastı (Austin veterinary) koşuları Apify aylık kullanım limiti dolduğu için bekliyor (`platform-feature-disabled: Monthly usage hard limit exceeded`). Limit yenilenince/yükseltilince koş: `npx tsx scripts/measure-review-velocity.ts --query "dental clinic" --lat 31.5493 --lng -97.1467` ve `--query "veterinary clinic" --lat 30.2672 --lng -97.7431`. Küçük şehirde medyan <2/ay çıkarsa adaptif kadans çekirdek tasarım kararı olur.
- 2. hafta geri dönüş oranı (kayıt kohortu bazında).
- Haftalık görev tamamlama trendi (north star'ın kendisi).
- "Yalnızca ilk analizi yapan" kullanıcı oranı (>%70 ise alarm).

**Panzehirler:**
1. **Görev damlatma (backlog drip):** ilk analiz 15-20 görev üretse bile hepsini gösterme; haftada 3-5 tanesini "bu haftanın görevleri" olarak sun (`priority_raw` sırasıyla, `09-task-engine.md` mekanizmasıyla doğal örtüşür). Yeni sinyal olmasa da her hafta "yeni" bir şey vardır.
2. **Kadansı yorum hızına bağla:** düşük hacimli kliniklerde döngü "haftalık" değil "iki haftalık/aylık + anlık alarm" olarak konumlansın.
3. **Delta bildirimleri:** "Rakibin bu hafta 12 yeni yorum aldı, 3'ü fiyat şikayeti" tarzı değişim bildirimleri — tekrarlayan dashboard'dan daha güçlü geri dönme nedeni.
4. **E-posta digest'i teslimat kanalı yap** (bkz. Bölüm D) — kullanıcının dönmesini bekleme, ona git.

Not: mevcut 14-gün re-priority ve 2x negatif patlama reopen kuralları (`09-task-engine.md`) *görev canlılığı* sağlar; bu risk *içerik tazeliği* ile ilgilidir. İkisi farklı problemdir, biri diğerini çözmez.

### Risk 2 — Öneriler jenerik/değersiz bulunur

"Fotoğraf ekle, yorum iste" düzeyinde öneri herkes verir; ürünün değeri **kanıtlı ve rakip-kıyaslı** öneridir ("rakiplerinde X teması 412 kez geçiyor, sende 18").

**Erken sinyaller:**
- Görev dismiss oranı > complete oranı.
- Destek/feedback'te "bunları zaten biliyordum" / "çok genel" frekansı.

**Panzehirler:**
- Kanıt satırı zorunluluğu (Faz 1.2'de zaten var, `10-roadmap.md`): kanıt yoksa görev üretme — sessiz kalmak jenerik konuşmaktan iyidir.
- Impact score'un kod tarafında bileşenlerden hesaplanması (Faz 1.2 açık maddesi) bu riskin doğrudan panzehiridir; önceliği yüksek tutulmalı.

### Risk 3 — Google veri erişimi zorlaşır (teknik/dışsal risk)

Ürün tamamen Google Maps/Review/GBP verisine kurulu. API değişikliği, rate limit, scraping zorlaşması veri kaynağını kesebilir.

**Erken sinyaller (ilk günden logla):**
- Apify scrape başarı oranı (job bazında).
- Yorum başına maliyet trendi.
- Scrape latency trendi.

**Panzehirler:**
- Scraper soyutlama katmanı: Apify'a doğrudan bağımlı kod tek modülde kalsın, sağlayıcı değiştirilebilir olsun.
- Maliyet/başarı oranı için eşik alarmı (örn. başarı <%90 veya maliyet 2x → bildirim).
- B planı dosyada dursun: alternatif scraper sağlayıcıları + resmi API seçeneklerinin listesi (uygulanması gerekmedikçe yatırım yapılmaz, sadece bilinir).

## B. Birdeye/Podium savunma hattı (öncelik sırasıyla)

"Biz de task veriyoruz" savunması kaybettirir. Gerçekçi savunma katmanları:

1. **Segment boşluğu (ilk 12 ayın asıl savunması):** Birdeye/Podium 300$+/ay ile çok şubeli işletmelere satış ekibiyle satar; tek şubeli klinik onlar için CAC'i çıkmayan müşteridir. Biz self-serve + 49-79$ ile onların *satmak istemediği* segmentteyiz. Özellik kopyalamak kolaydır; fiyat/segment/satış modeli kopyalamak zordur.
2. **Bakış yönü:** onlar "kendi itibarını yönet" (inbound) araçları; biz "rakibi izle" (istihbarat). Konumlandırmada bu ayrım hep önde tutulur (`01-product-vision.md` ile tutarlı).
3. **Vertical derinlik:** tedavi/doktor kırılımı (implant, veneer, aligner… — Faz 2) sadece özellik değil, **rekabet savunması** olarak çerçevelenir. Yatay oyuncular bu derinliğe inmez.
4. **Dataset moat (uzun vade):** klinik-yorum korpusu zamanla moat olur ama 12 aylık ufukta savunma sayılmaz; plana etki etmez.

**Erken sinyal:** onboarding'de zorunlu soru — "şu an rakip/itibar takibi için ne kullanıyorsunuz?" Churn görüşmelerinde "Birdeye'a geçtik" frekansı izlenir. Rakip changelog'u değil, kendi churn nedenlerimiz asıl sinyaldir.

## C. Fiyat hipotezi

- **Bant: 49-79$/ay.** 19$'a inilmez — iki nedenle: (1) ürün gelir artırıcıdır, maliyet aracı değil; (2) LemonSqueezy MoR kesintisi (%5 + 50¢) düşük fiyatta marjı eritir.
- **Çapalar:** ajans raporu 500-1500$/ay; Birdeye 300$+/ay; "kendim bakarım" = 0$ ama pratikte hiç bakılmıyor.
- **Satış cümlesi (pricing sayfasının özü):** bir implant hastasının değeri 2.000$+ → **"yılda tek bir ek hasta, bir yıllık aboneliği 3-5 kat öder."** "Birdeye'dan ucuz" diye değil, hasta değeri üzerinden satılır.
- **Doğrulama:** fiyat sayfası + ön-satış görüşmeleri; iki tier ile başla, yıllık indirim test et. Fiyat MVP'den önce "doğru" bilinemez, sadece çapalanır.

## D. En zayıf varsayım ve test planı

**Varsayım:** "Kullanıcı haftalık görev tamamlamak ister." Bu doğrudan north star metriğidir (`10-roadmap.md`) ve şu an **kanıtsız hipotezdir**. MVP'nin asıl amacı AI pipeline kurmak değil, bu varsayımı test etmektir.

**Concierge test (kod beklemeden):**

> **Ön koşul — önce konuş, sonra mail at.** Tanımadığımız kliniklere durduk yere analiz maili atılmaz: hem spam/KVKK sorunu, hem de sonuç çöp olur (istenmeyen mailin açılmaması varsayım hakkında hiçbir şey söylemez). Test yalnızca **rıza vermiş gönüllülerle** anlamlıdır — ölçtüğümüz şey "isteyen kullanıcı bile görevleri yapıyor mu?" Gönüllüler bile tamamlamıyorsa, ödeme yapan soğuk kullanıcı hiç tamamlamaz; sinyal bu yüzden güçlüdür.

1. **Görüşme ayarla (1-2 hafta):** 10-15 klinik sahibi/müdürüyle kısa görüşme — tanıdık çevre, tanıdığın tanıdığı, ya da "size ücretsiz rakip analizi çıkarayım, karşılığında 15 dk geri bildirim" teklifiyle soğuk erişim. Görüşmelerin kendisi zaten veridir: rakiplerini takip ediyorlar mı, neyle, ne kadar umursuyorlar?
2. **Açık anlaşma:** "4 hafta boyunca her hafta rakip analizinden çıkan 3-5 görev maili atacağım; tek istediğim hangilerini yaptığınızı söylemeniz."
3. Mevcut pipeline'ı elle çalıştır, çıktıyı **haftalık e-posta** olarak gönder ("bu hafta yapman gereken 3-5 şey" + kanıt satırları).
4. Her hafta reply ile sor: "geçen haftakilerden hangisini yaptınız?"
5. 4 hafta sürdür → gerçek tamamlama oranı elde edilir. Sıfır ek kod, sıfır UI.

**Karar eşikleri (önceden yazılı, sonradan oynanmaz):**
- Kullanıcıların ≥%30'u haftada en az 1 görev tamamlıyorsa → varsayım yaşıyor, dashboard'lu forma devam.
- %10-30 arası → kadans/format değiştir (iki haftalık, daha az görev), tekrar ölç.
- <%10 → **ürün formu değişir**: görev motoru değil, e-posta digest + alarm ürünü ("bana mail at" bir itiraz değil, ürün formu olabilir).

**E-posta digest notu:** Faz 1.1'deki "E-posta özet bildirimi" maddesi sadece bir bildirim özelliği değil, potansiyel **ana teslimat kanalıdır**. Dashboard = detay için tıklanan yer, digest = ürünün kendisi olabilir. Bu aynı zamanda Risk 1'in en güçlü panzehiridir.

## E. Aksiyon listesi (sıralı)

**MVP tamamlanmadan / hemen şimdi:**
- [x] Rakip başına aylık yorum hızı ölçümü — Apify ile 20-30 gerçek klinik örnekle (Risk 1 ön-doğrulaması, kadans kararını belirler). *Yapıldı: Austin dental, n=25, medyan 9.0/ay — "haftalık" kadans doğrulandı (bkz. Risk 1 altındaki ÖLÇÜLDÜ notu). Kalan: Waco + veterinary kontrast koşuları (Apify aylık limiti bekliyor).*
- [ ] Klinik sahipleriyle görüşme ayarla (Bölüm D adım 1) — concierge testin ön koşulu; mail ancak rıza sonrası atılır.
- [ ] Concierge test — 10-15 gönüllü klinik, 4 hafta (Bölüm D).
- [ ] Scrape başarı oranı / maliyet / latency loglaması pipeline'a eklensin (Risk 3 sinyalleri).
- [ ] Onboarding'e "şu an ne kullanıyorsunuz?" sorusu (Bölüm B sinyali).

**MVP sonrası / Faz 1.1 ile birlikte:**
- [ ] Görev damlatma (backlog drip) mekanizması — haftada 3-5 görev sunumu.
- [ ] E-posta digest'ini teslimat kanalı olarak tasarla (concierge test sonucuna göre ağırlığı belirlenir).
- [ ] Delta bildirimleri ("rakibin bu hafta X yeni yorum aldı") — bildirim kuralları (`02-business-rules.md` Bölüm G) ile birlikte.
- [ ] Scrape eşik alarmları (başarı <%90, maliyet 2x).

**Sürekli izlenen metrikler:** 2. hafta dönüş oranı · yalnızca-ilk-analiz kullanıcı oranı · dismiss/complete oranı · scrape başarı-maliyet-latency · churn'de Birdeye frekansı.
