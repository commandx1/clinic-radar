# Billing Doğrulama Runbook'u (LemonSqueezy)

> Amaç: prod'a çıkmadan önce (ve her billing değişikliğinden sonra) ödeme akışının uçtan uca doğrulanması. Kod referansları: `src/lib/billing/`, `src/app/api/billing/`, `src/app/api/webhooks/billing/route.ts`. Kurallar: `02-business-rules.md` Bölüm A, endpoint sözleşmeleri: `04-api.md`.

## 0. Ön Koşullar

- LemonSqueezy hesabında **Test Mode** açık (sağ üst toggle). Tüm doğrulama test mode'da yapılır; canlıya geçişte aynı adımlar live store ile tekrarlanır.
- Env değişkenleri set edilmiş olmalı (Vercel → Project → Settings → Environment Variables):

| Değişken | Kaynak |
|---|---|
| `LEMONSQUEEZY_API_KEY` | LemonSqueezy → Settings → API |
| `LEMONSQUEEZY_STORE_ID` | Store ayarları (sayısal ID) |
| `LEMONSQUEEZY_PRO_VARIANT_ID` | Pro plan ürününün variant ID'si |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | Webhook oluştururken belirlenen signing secret |

- Webhook kaydı: LemonSqueezy → Settings → Webhooks → `https://<prod-domain>/api/webhooks/billing`. Event seçimi: `subscription_created`, `subscription_updated`, `subscription_cancelled`, `subscription_resumed`, `subscription_expired`, `subscription_paused`, `subscription_unpaused`. (`subscription_payment_*` event'leri **seçilse bile işlenmez** — bkz. `04-api.md`; gövde şeması farklıdır, handler sessizce yok sayar.)
- Lokal doğrulama için webhook'u tünelle almak istersen: `ngrok http 3000` → webhook URL'ini geçici olarak tünel adresine çevir. İş bitince prod URL'e geri al.

## 1. Checkout Akışı

1. Test kullanıcısıyla giriş yap, `GET /api/billing/checkout`'a giden UI linkine tıkla (upgrade butonu).
2. **Beklenen:** LemonSqueezy hosted checkout'a 307 redirect; sayfada doğru ürün/fiyat görünür.
3. Test kartıyla öde: `4242 4242 4242 4242`, gelecekte bir tarih, herhangi bir CVC.
4. **Beklenen (webhook sonrası, <1 dk):**
   - `subscriptions` satırında `plan = 'pro'`, `status = 'active'`.
   - `lemonsqueezy_customer_id`, `lemonsqueezy_subscription_id`, `lemonsqueezy_variant_id`, `lemonsqueezy_customer_portal_url` dolu.
   - Eşleştirme `meta.custom_data.user_id` üzerinden yapılır (checkout'ta set edilir); dashboard'da Pro limitleri (10 rakip, haftalık döngü) aktifleşir.

Doğrulama SQL'i (Supabase SQL editor):

```sql
select plan, status, lemonsqueezy_subscription_id, lemonsqueezy_variant_id
from subscriptions where user_id = '<test-user-uuid>';
```

## 2. Webhook İmza Doğrulaması

1. LemonSqueezy webhook panelinden son event'in "Resend" özelliğiyle aynı event'i tekrar gönder → **200** dönmeli (idempotent; DB durumu değişmez).
2. `curl` ile imzasız istek at:

```bash
curl -si -X POST https://<prod-domain>/api/webhooks/billing \
  -H 'Content-Type: application/json' -d '{"meta":{"event_name":"subscription_updated"}}'
```

**Beklenen:** `401` (imza yok/geçersiz). İmza doğrulaması ham body üzerinde HMAC-SHA256 + timing-safe karşılaştırmadır (`verify-webhook-signature.ts`) — proxy/middleware'in body'yi değiştirmediğinden emin ol.

## 3. İptal Akışı

1. Pro kullanıcıyla UI'dan iptal et (`POST /api/billing/cancel`).
2. **Beklenen:** 200; LemonSqueezy'de subscription "cancelled (ends at period end)" durumuna geçer. DB **hemen değişmez** — senkron webhook'tan gelir.
3. `subscription_cancelled` webhook'u sonrası: `status = 'cancelled'`, plan dönem sonuna kadar `pro` erişimli kalır (kural: `02-business-rules.md`).
4. Kenar durumlar: aktif abonelik yokken cancel → **404**; zaten iptal edilmişken → **409**.
5. LemonSqueezy panelinden "Resume" → `subscription_resumed` webhook'u ile `status = 'active'`'e dönmeli.

## 4. Süre Dolumu / Ödeme Başarısızlığı

- Test mode'da subscription'ı panelden **Expire** et → `subscription_expired` webhook'u ile `plan = 'free'` düşüşü ve Free limitlerinin (3 rakip, ayda 1 döngü) uygulandığını doğrula.
- `paused`/`unpaused` geçişlerini panelden tetikleyip `status` alanının senkron kaldığını doğrula.

## 5. Regresyon Testleri

Her billing değişikliğinde lokal olarak:

```bash
npx vitest run src/lib/billing/
```

`handle-webhook-event.test.ts` (event eşleme, user_id/subscription_id fallback, bilinmeyen event'lerin yok sayılması) ve `verify-webhook-signature.test.ts` (geçerli/geçersiz/eksik imza) geçmeli.

## 6. Canlıya Geçiş

1. Test Mode kapat, live store'dan **yeni** API key + variant ID + webhook secret al — test mode credential'ları live'da çalışmaz.
2. Vercel production env'lerini live değerlerle güncelle, redeploy.
3. Bölüm 1-3'ü **gerçek kartla düşük riskli şekilde** tekrarla (kendi kartınla satın al → doğrula → iptal et; LemonSqueezy panelinden refund).
4. Webhook panelinde delivery loglarını 24 saat izle — non-2xx birikimi varsa `LEMONSQUEEZY_WEBHOOK_SECRET` uyumsuzluğu ilk şüphelidir.
