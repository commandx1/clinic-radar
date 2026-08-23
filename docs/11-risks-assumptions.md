# 11 — Riskler, Varsayımlar ve Savunma Hattı

> Amaç: ürünü 12 ay içinde öldürebilecek riskleri, her birinin **ölçülebilir erken sinyalini** ve panzehirini tek yerde tutmak. Bu doküman bir "korku listesi" değil, izleme + aksiyon planıdır. Her risk için erken sinyal metriği ilk günden loglanmalıdır — sinyal yoksa risk yönetilemez.

## A. Ölüm riskleri (kill risks)

### Risk 1 — Kullanıcı ilk analizden sonra geri dönmez (en büyük risk)

**Kök neden (kritik nüans):** Bu bir "retention özelliği eksikliği" problemi değil, **veri yenilenme hızı** problemi. Haftalık "yeni içerik" üretebilmek, rakiplerin o hafta yeni yorum almasına bağlı. Tek şubeli klinik + 3-10 rakip evreninde haftalık yeni yorum sayısı düşük olabilir; yeni sinyal yoksa görevler tekrar eder ve kullanıcı "bunu zaten görmüştüm" der.

**Erken sinyaller (ölçülebilir):**
- **MVP öncesi ölçülebilir:** hedef segmentte rakip başına aylık ortalama yorum hızı — Apify ile 20-30 gerçek klinik örnekleyerek ölç. Medyan düşükse "haftalık" kadans vaadi baştan yanlıştır.
  - **ÖLÇÜLDÜ (2026-07-04, Austin "dental clinic", n=25):** medyan **9.0 yorum/ay**, p25=3.3, p75=15.3; kliniklerin **%72**'si haftada ≥1 yorum alıyor (≥4.3/ay), yalnızca %12'si ayda <2 yorumda. Scrape başarı %100. → Büyük metro + dental için "haftalık" kadans vaadi **doğrulandı**; panzehir #2 (hacme göre kadans) %12'lik düşük hacimli kuyruk için hâlâ gerekli ama edge case. Detay: `docs/research/review-velocity-dental-clinic-2026-07-04.md`.
  - **ÖLÇÜLDÜ — kontrast koşuları (2026-07-04):** Waco "dental clinic" (n=25): medyan **5.3 yorum/ay**, p25=1.7, p75=14.3. Austin "veterinary clinic" (n=25): medyan **5.0 yorum/ay**, p25=2.3, p75=11.3. Çıkarımlar: **(a)** Küçük şehirde bile medyan klinik haftada ~1.2 yorum alıyor → haftalık digest medyan klinik için hâlâ dolu gelir; ama Waco p25=1.7/ay → alt çeyrekte çoğu hafta boş digest riski gerçek. Panzehir #2 (adaptif kadans) küçük pazarlarda edge case değil, **çekirdek tasarım kararı**. **(b)** Veterinary dağılımı dental'a çok yakın (5.0 vs 9.0/5.3) → sinyal hacmi dikeye değil "local clinic" kategorisine özgü; ürün dental'a kilitlenmek zorunda değil, TAM genişletilebilir. **(c)** Şehir büyüklüğü etkisi ~%40 (Austin 9.0 → Waco 5.3) → ICP'de metro+banliyö öncelikli, küçük pazarlar ikinci dalga. **Sonuç:** "yeterli yorum hacmi yok" hipotezi metrolarda **çürütüldü**, küçük şehir alt çeyreği için **kısmen geçerli** (adaptif kadansla yönetilir). Detay: `docs/research/review-velocity-dental-clinic-waco-2026-07-04.md`, `docs/research/review-velocity-veterinary-clinic-2026-07-04.md`.
- 2. hafta geri dönüş oranı (kayıt kohortu bazında).
- Haftalık görev tamamlama trendi (north star'ın kendisi).
- "Yalnızca ilk analizi yapan" kullanıcı oranı (>%70 ise alarm).

**Panzehirler:**
1. **Görev damlatma (backlog drip):** ilk analiz 15-20 görev üretse bile hepsini gösterme; haftada 3-5 tanesini "bu haftanın görevleri" olarak sun (`priority_raw` sırasıyla, `09-task-engine.md` mekanizmasıyla doğal örtüşür). Yeni sinyal olmasa da her hafta "yeni" bir şey vardır.
2. **Kadansı yorum hızına bağla:** düşük hacimli kliniklerde döngü "haftalık" değil "iki haftalık/aylık + anlık alarm" olarak konumlansın.
3. **Delta bildirimleri:** "Rakibin bu hafta 12 yeni yorum aldı, 3'ü fiyat şikayeti" tarzı değişim bildirimleri — tekrarlayan dashboard'dan daha güçlü geri dönme nedeni.
4. **E-posta digest'i teslimat kanalı yap** (bkz. Bölüm D) — kullanıcının dönmesini bekleme, ona git.
5. **Adaptif analiz penceresi** (`AI_ANALYSIS_WINDOW_DAYS_STEPS`, `02-business-rules.md` Bölüm C): bu risk aslında **ilk analizde de** gerçekleşebiliyor, sadece sonraki döngülerde değil — 2026-07-06'da prod'da gözlemlendi: gerçek bir klinik (162 own + 200/61/56 rakip yorumu) ilk analizde 0 görev üretti çünkü son 90 günde own tarafında yalnızca 1-2 metinli yorum vardı, hiçbir tema `TASK_MENTION_THRESHOLD`'u (5) geçemedi — DB'de eski ama gerçek yorumlar dururken pencere onları görmezden geliyordu. Sabit kadans yavaşlatma (panzehir #2) bu durumu çözmüyor; pencerenin kendisinin işletmenin gerçek yorum hızına göre genişlemesi gerekiyordu.

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

1. **Segment boşluğu (ilk 12 ayın asıl savunması):** Birdeye/Podium 300$+/ay ile çok şubeli işletmelere satış ekibiyle satar; tek şubeli klinik onlar için CAC'i çıkmayan müşteridir. Biz self-serve + 29$ (bkz. Bölüm C kararı) ile onların *satmak istemediği* segmentteyiz. Özellik kopyalamak kolaydır; fiyat/segment/satış modeli kopyalamak zordur.
2. **Bakış yönü:** onlar "kendi itibarını yönet" (inbound) araçları; biz "rakibi izle" (istihbarat). Konumlandırmada bu ayrım hep önde tutulur (`01-product-vision.md` ile tutarlı).
3. **Vertical derinlik:** tedavi/doktor kırılımı (implant, veneer, aligner… — Faz 2) sadece özellik değil, **rekabet savunması** olarak çerçevelenir. Yatay oyuncular bu derinliğe inmez.
4. **Dataset moat (uzun vade):** klinik-yorum korpusu zamanla moat olur ama 12 aylık ufukta savunma sayılmaz; plana etki etmez.

**Erken sinyal:** onboarding'de zorunlu soru — "şu an rakip/itibar takibi için ne kullanıyorsunuz?" Churn görüşmelerinde "Birdeye'a geçtik" frekansı izlenir. Rakip changelog'u değil, kendi churn nedenlerimiz asıl sinyaldir.

## C. Fiyat hipotezi

- **KARAR (2026-08-23): Pro = 29$/ay.** Bu bir hipotez değil, verilmiş bir karardır — kod (`src/lib/marketing/pricing-plans.ts` `PRO_PLAN_PRICE_USD = 29`) esastır, bu doküman onu takip eder. Önceki 49-79$ bandı **hipotezdi ve terk edildi**; aşağıdaki gerekçeyle çakışan eski bir metin görürsen bu maddeyi doğru kabul et.
  - **Marj gerekçesi (ölçüldü, tahmin değil):** 2026-08-23 pilotunda her analiz döngüsü 720 yorum çekti (kullanıcı + 3 rakip). Apify'ın tipik yorum-başı fiyatıyla bu ~0,4-0,7$/döngü; Pro'nun haftalık kadansında ~2-3$/ay. AI tarafı Claude ile ~0,20$/döngü (~0,9$/ay), Gemini ile belirgin daha ucuz. LemonSqueezy MoR kesintisinden (%5 + 50¢) sonra 29$ → net ~27$ ⇒ **brüt marj ~%85.** Dolayısıyla eski "19$ altına inilmez, MoR marjı eritir" gerekçesi 29$ için geçerli değil. **Uyarı:** 10 rakipli, yüksek yorum hacimli bir klinikte scrape maliyeti 3-4 katına çıkabilir — bu yüzden `APIFY_PRICE_PER_REVIEW_USD` prod'da MUTLAKA set edilmeli (bkz. `launch-checklist.md`), aksi halde `analysis_runs.scrape_cost_usd` null kalır ve kullanıcı başı maliyet kör noktada olur.
  - **Konumlandırma gerekçesi:** araştırmanın (bkz. `docs/research/value-sprint-2026-08-23.md`) en net bulgusu, kliniklerin fiyattan değil **faturalama güvensizliği** ve **aksiyona dönüşmeyen dashboard**'dan kaçtığıdır. Birdeye/Weave 250-400$/lokasyon isterken 29$ ile 49$ arasındaki fark, bir implant hastasının değeri (2.000$+) yanında gürültüdür. 29$'ın gerçek faydası "ucuzluk" değil, sıfır sosyal kanıtla lansmanda **düşünmeden denenebilirlik**tir.
  - **Korunacak üç şey (kararın parçası):** (1) **Tavan kaybedilmez** — 79$ ileride çoklu-lokasyon/ajans katmanı olarak saklanır; giriş fiyatını düşürmek upsell tavanını düşürmek anlamına gelmez. (2) **Erken kullanıcılar grandfather'lanır** — fiyat artarsa ilk müşteriler 29$'da kalır; bu, #1 churn nedenine (fiyat sürprizi/güvensizlik) doğrudan panzehirdir. (3) **Şartlar korunur** — sözleşme yok, varsayılan aydan aya, fiyat sayfada açık (satış görüşmesi arkasına saklanmaz).
  - **İzlenecek karşı-sinyal:** 29$ ürünü "ciddi klinik yazılımı" yerine "ucuz eklenti" gibi konumlandırabilir. Bunu fiyat değil, ilk oturumda gösterilen şey belirler (ör. "rakip medyanı 5.0 / sen 3.38" açılışı). Churn görüşmelerinde "ucuz olduğu için güvenmedim" frekansı izlenir; çıkarsa fiyat değil **kanıt sunumu** güçlendirilir.
- **Çapalar:** ajans raporu 500-1500$/ay; Birdeye 300$+/ay; "kendim bakarım" = 0$ ama pratikte hiç bakılmıyor.
- **Satış cümlesi (pricing sayfasının özü):** bir implant hastasının değeri 2.000$+ → **"yılda tek bir ek hasta, bir yıllık aboneliği 3-5 kat öder."** "Birdeye'dan ucuz" diye değil, hasta değeri üzerinden satılır.
- **Doğrulama:** fiyat sayfası + ön-satış görüşmeleri; yıllık indirim test edilir (varsayılan aylık kalır). Fiyatın kendisi karara bağlandı (yukarı), açık kalan soru fiyat değil **kaç tier** olacağıdır — ikinci tier (79$, çoklu-lokasyon/ajans) ilk gerçek talep gelince eklenir, önceden kurulmaz.

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
- [x] Rakip başına aylık yorum hızı ölçümü — Apify ile 20-30 gerçek klinik örnekle (Risk 1 ön-doğrulaması, kadans kararını belirler). *Yapıldı: Austin dental (medyan 9.0/ay), Waco dental (5.3/ay), Austin veterinary (5.0/ay) — hepsi n=25. "Haftalık" kadans metroda doğrulandı; küçük şehir alt çeyreği için adaptif kadans çekirdek karar oldu (bkz. Risk 1 altındaki ÖLÇÜLDÜ notları). Tamamlandı, kalan koşu yok.*
- [ ] Klinik sahipleriyle görüşme ayarla (Bölüm D adım 1) — concierge testin ön koşulu; mail ancak rıza sonrası atılır.
- [ ] Concierge test — 10-15 gönüllü klinik, 4 hafta (Bölüm D).
- [x] Scrape başarı oranı / maliyet / latency loglaması pipeline'a eklensin (Risk 3 sinyalleri). *Yapıldı: her koşuda `analysis_runs.scrape_success/fetched_reviews/scrape_latency_ms/scrape_cost_usd` yazılır (bkz. `03-database.md`); maliyet `APIFY_PRICE_PER_REVIEW_USD` env'inden tahmin edilir. Eşik alarmları hâlâ Faz 1.1 maddesi (aşağıda).*
- [x] Onboarding'e "şu an ne kullanıyorsunuz?" sorusu (Bölüm B sinyali). *Yapıldı: işletme bağlama formunda zorunlu serbest metin alanı, `businesses.current_tool` kolonuna yazılır (bkz. `03-database.md`).*

**MVP sonrası / Faz 1.1 ile birlikte:**
- [x] Görev damlatma (backlog drip) mekanizması — haftada 3-5 görev sunumu. *Ayrı bir kuyruk/`revealed_at` sistemi yerine mevcut `MAX_NEW_TASKS_PER_CYCLE=5` sınırı bu ihtiyacı zaten karşılıyor: her analiz döngüsünde adaylar impact/effort oranına göre sıralanıp yalnızca en iyi 5'i oluşturulur/güncellenir (bkz. `execute-analysis.ts` `rankAndCapCandidates`); üstteki 5 tamamlanınca/dismiss olunca alttaki adaylar bir sonraki döngüde doğal olarak yükselir. Statik bir "kuyruktan sırayla açma" yerine dinamik yeniden sıralama — aynı sonucu daha az karmaşıklıkla verir.*
- [x] E-posta digest'ini teslimat kanalı olarak tasarla (concierge test sonucuna göre ağırlığı belirlenir). *Altyapı hazır: `sendWeeklyDigests` idempotent toplu gönderim yapıyor (bkz. `weekly-digest.ts`); ağırlık/konumlandırma kararı hâlâ concierge test sonucuna bağlı, bu doküman değişikliği gerektirmez.*
- [x] Delta bildirimleri ("rakibin bu hafta X yeni yorum aldı") — bildirim kuralları (`02-business-rules.md` Bölüm G) ile birlikte. *`theme_spike` (kritik sinyal, anlık) ve `competitor_review_delta` (yeni görev, haftalık özette) türleri bu ihtiyacı karşılıyor.*
- [x] Scrape eşik alarmları — başarı oranı yarısı yapıldı, maliyet 2x hâlâ açık. *`runCronAnalysisCycle`, döngü sonunda (`processed >= 1` iken) scrape başarı oranını (`scrapeSuccessCount / processed`) hesaplar; oran `SCRAPE_SUCCESS_RATE_ALERT_THRESHOLD` (0.5) altına düşerse tek bir yapılandırılmış `console.error("[alert] scrape success rate below threshold", ...)` basılır ve `scrapeSuccessRate`/`scrapeAlert` cron JSON yanıtına eklenir (bkz. `04-api.md`, `src/lib/analysis/scrape-success-alert.ts`) — e-posta göndermez, yalnızca gözlem/log. Maliyet 2x alarmı henüz eklenmedi, ayrı bir takip maddesi olarak açık kalıyor.*

**Sürekli izlenen metrikler:** 2. hafta dönüş oranı · yalnızca-ilk-analiz kullanıcı oranı · dismiss/complete oranı · scrape başarı-maliyet-latency · churn'de Birdeye frekansı.
