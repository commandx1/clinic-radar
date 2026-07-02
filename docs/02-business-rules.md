# 02 — Business Rules

Bu doküman, `05-ai-pipeline.md` ve `09-task-engine.md` içindeki mantığın referans aldığı kesin kuralları içerir. Claude Code kod üretirken burayı tek doğruluk kaynağı olarak kullanmalı — mantık kodun içine dağınık şekilde gömülmemeli, mümkün olduğunca merkezi bir `config`/`constants` dosyasında tutulmalı.

## A. Hesap & Plan Limitleri
- Free plan: 1 işletme, maksimum **3 rakip**, ayda **1 analiz döngüsü**.
- Pro plan: 1 işletme, maksimum **10 rakip**, **haftalık** analiz döngüsü.
- Bir kullanıcı en az **3, en fazla 10** rakip seçebilir (checkbox onboarding adımında zorunlu min/max validasyonu).
- Ajans planı (Faz 2): plan başına çoklu işletme, her işletme kendi rakip limitine tabi.
- **Fiyatlandırma:** tüm planlar tek bir **USD** fiyatıyla satılır — bölgeye göre ayrı para birimi/fiyat listesi yok. LemonSqueezy Merchant of Record olarak yerel KDV/satış vergisini currency'den bağımsız zaten yönetiyor, kart ağları dönüşümü otomatik yapıyor (global SaaS'larda standart yaklaşım). PPP bazlı bölgesel indirim gelecekte değerlendirilebilecek bir optimizasyon — MVP kapsamı dışı.

## B. Rakip Keşif Kuralları
- Varsayılan arama yarıçapı: **4 km**.
- Varsayılan minimum yorum eşiği: **100 yorum**.
- Yeterli aday (≥10) bulunamazsa: yarıçap sırasıyla **6 km → 10 km**'ye genişler.
- Yarıçap genişlemesine rağmen yeterli aday yoksa: yorum eşiği sırasıyla **75 → 50**'ye düşer.
- Her iki genişleme de tükendiğinde bulunan adaylarla devam edilir (10'dan az olabilir), kullanıcıya "bölgenizde sınırlı sayıda güçlü rakip bulundu" mesajı gösterilir.

## C. Veri Tazeliği Kuralları
- `region_category_cache` TTL: **7 gün** (yoğun bölgeler) — **14 gün** (düşük yoğunluklu bölgeler, aynı geo_cell'de <5 aktif kullanıcı varsa).
- Yorum trend hesaplamasına dahil edilen pencere: **son 90 gün**. 90 günden eski yorumlar temaların varlığını etkiler ama trend yönünü (artıyor/azalıyor) etkilemez.
- Rakip yorumları haftalık yeniden çekilir (Pro plan); Free plan'da aylık.

## D. Görev Oluşturma Kuralları

**İki görev kaynağı vardır — ikisi de eşit önemde:**

1. **Rekabetçi fark** (`source_type = 'competitive_gap'`): rakip(ler) bir temada güçlü, kullanıcı o temada zayıf/eksik.
2. **Mutlak kalite sorunu** (`source_type = 'absolute_quality'`): kullanıcının **kendi** yorumlarında bir temanın negatif mention oranı **%30'u** aşıyorsa VE toplam mention sayısı **≥5** ise, rakip karşılaştırmasında fark olmasa bile (yani tüm rakipler de aynı konuda kötü olsa bile) görev üretilir. Bu kural, "herkes kötüyse sorun değil" körlüğünü engellemek için var — bölgedeki tüm klinikler aynı konuda zayıfsa bu hâlâ hasta memnuniyetini etkileyen gerçek bir sorundur, sadece rekabet avantajı sağlamaz.

- Bir tema için (her iki kaynak türünde de) görev oluşturulması için: ilgili yorum grubunda o temaya dair **en az 5 negatif/pozitif mention** olmalı (gürültüyü elemek için — 1-2 münferit yorumdan görev türetilmez).
- Aynı tema için kullanıcıda zaten `open` durumda bir görev varsa, yeni analiz döngüsünde **duplicate görev oluşturulmaz** — mevcut görev güncellenir (mention_count, priority yeniden hesaplanır).
- Bir analiz döngüsünde en fazla **5 yeni görev** oluşturulur (kullanıcıyı boğmamak için) — kalan fırsatlar "gelecek dönem" havuzunda tutulur.

## E. Görev Yaşam Döngüsü Kuralları
- Görev durumları: `open` → `done` | `dismissed`.
- Bir görev **14 gün** içinde `open` durumda kalırsa, önceliği (`09-task-engine.md`'deki formülle) yeniden hesaplanır — yeni yorumlar temaya destek veriyorsa öncelik artar, azalıyorsa düşer.
- Bir görev **60 gün** boyunca `open` kalır ve öncelik "low"a düşerse, otomatik olarak `dismissed` durumuna alınır ve kullanıcıya bildirilir.
- `dismissed` bir görev, aynı temada yeni bir negatif sinyal patlaması olursa (mention_count önceki döngüye göre 2x artarsa) yeniden `open` olarak türetilebilir.

## F. Skor Hesaplama Kuralları
- **Clinic Score** (0-100): kullanıcının kendi rating'i, review_count trendi ve tamamlanan görev oranının ağırlıklı ortalaması. Kesin formül `09-task-engine.md`'de.
- **Opportunity Score** her görev için `impact_score` (0-100) ve `effort_score` (1-5) alanlarından türetilir. Detay `09-task-engine.md`.
- **Competitor Rank**: kullanıcının seçtiği rakipler + kendisi rating'e göre sıralanır, kullanıcının sırası gösterilir (ör. "4/12").

## G. Bildirim Kuralları (Faz 1.1)
- Yeni görev oluştuğunda: haftalık özet e-postasına dahil edilir (anlık bildirim yok, MVP'de bildirim yorgunluğunu önlemek için).
- Bir görev 60 günde otomatik `dismissed` olduğunda: kullanıcıya bilgilendirme e-postası gider.
- Kritik sinyal (bir temada mention_count bir haftada 3x artarsa): anlık bildirim tetiklenir (Pro plan).

## H. Veri & Gizlilik Kuralları
- Ham yorum metni veritabanında saklanır (analiz için gereklidir) ama **kullanıcı arayüzünde asla birebir gösterilmez** — sadece Claude'un ürettiği özet gösterilir (bkz. `01-product-vision.md` ürün ilkeleri).
- `translated_text` alanı sadece Faz 2 çok dilli analizde kullanılır, Faz 1'de null kalabilir.
