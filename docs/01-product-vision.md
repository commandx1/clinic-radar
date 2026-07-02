# 01 — Ürün Vizyonu & Konumlandırma

## Tek cümlelik tanım
ClinicRadar, işletme sahibine "rakiplerin neden senden iyi puan alıyor" sorusunu cevaplayan ve bunu **somut, tamamlanabilir görevlere** çeviren bir rakip istihbaratı ve görev motorudur.

## Problem
- İşletme sahipleri rakiplerinin yorumlarını okuyacak vakit bulamıyor.
- Mevcut reputation araçları (Birdeye, Podium, Emitrr vb.) "yorum iste + yanıtla" otomasyonuna odaklı; "nerede geride kalıyorum, ne yapmalıyım" sorusuna cevap vermiyor.
- Sağlık/diş kuruluşlarında yorum kalitesi doğrudan hasta akışını etkiliyor — acı yüksek, ödeme isteği yüksek.

## Farklılaşma — "Review Analytics" değil, "Task Engine"
Piyasadaki araçlar bir **skor** veya **rapor** verir, kullanıcı ne yapacağını kendi çıkarır. ClinicRadar bunun yerine:
1. Rakiple aradaki farkı bulur,
2. Bu farkı önceliklendirir (Opportunity Score — bkz. `09-task-engine.md`),
3. Tek oturumda anlaşılır bir göreve çevirir.

Kullanıcı rapor okumuyor, görev tamamlıyor. Bu, ürünün retention motoru.

## Hedef kullanıcı
- **Faz 1:** Herhangi bir ülkede, tek şubeli sağlık/estetik klinikleri (diş, estetik/güzellik, dermatoloji, med-spa vb. — kapalı bir liste değil, Google Maps'in verdiği kategori neyse o kabul edilir, bkz. `03-database.md` "Açık soru: kategori normalizasyonu").
- **Faz 2:** Çok şubeli klinik zincirleri; turistik/uluslararası hasta çeken klinikler için karışık dilli yorum kırılımı (yabancı dildeki yorumların ayrı gösterilmesi/analizi, bkz. `03-database.md` `translated_text`) — bu herhangi bir ülkedeki kliniğe uygulanabilir, tek bir ülkeye özel değil.
- Karar verici: klinik sahibi/yöneticisi veya bu kuruluşlara hizmet veren dijital ajans (white-label potansiyeli, Faz 2).

## Arayüz dili (global, Faz 1'den itibaren)
Ürün baştan global kullanım için tasarlanır: **arayüz dili** kullanıcının cihaz diline göre otomatik seçilir, sabit Türkçe değildir (bkz. `07-ui.md`). Bu, yukarıdaki Faz 2 "çok dilli yorum analizi"ndan ayrı bir konu — arayüz metinleri (butonlar, sayfa içerikleri, Claude'un ürettiği özetler) çeviridir, henüz *yabancı dildeki yorumları analiz etmek* değildir.

## Kuzey yıldızı metrik
**Haftalık tamamlanan görev sayısı / kullanıcı.** Bu, hem ürünün gerçekten kullanılıp kullanılmadığını hem de değer üretip üretmediğini aynı anda ölçer. Diğer tüm metrikler (Bkz. `10-roadmap.md`) bunun etrafında ikincildir.

## Ürün ilkeleri (non-goal'lar dahil)
- **Bu ürün Faz 1'de otomatik yorum isteme / SMS-e-posta gönderme yapmaz.** Bu, GDPR ve benzeri (HIPAA, KVKK vb.) hasta iletişimi regülasyon rejimlerinin yükünü getirir ve mevcut oyuncuların zaten doyurduğu alan. Biz sadece kamuya açık veriyi analiz ediyoruz.
- **Ham yorum metni asla kullanıcıya birebir "alıntı" olarak sunulmaz** — Claude her zaman kendi cümleleriyle özetler. Hem telif hem ToS riskini azaltır, hem de ürünü "rapor okuma" değil "aksiyon alma" deneyimine zorlar.
- **Rakip seçimi kullanıcı kontrolünde kalır** (checkbox), AI rakip seçmez — bu hem güven hem de "buy-in" yaratır (bkz. `07-ui.md`).
