-- ============ Trustpilot kaynağı: şema hazırlığı (Faz 1) ============
-- bkz. docs/02-business-rules.md Bölüm I "Yorum Kaynakları (Multi-Source)",
-- docs/03-database.md
--
-- Bu migration Trustpilot'a özgü HİÇBİR mantık (adaptör, probe, registry
-- kaydı) eklemez — yalnızca şemayı ve `website` verisinin akışını hazırlar.
-- İkinci parça Trustpilot adaptörünü ve kaynak kaydını ekleyecek.
--
-- Trustpilot'ta bir şirketin kimliği place_id değil, domain'dir (ör.
-- 'natural.clinic'). Bu domain Google Places'in döndürdüğü `website`
-- alanından türetilecek; bu yüzden ham `website` alanını da saklıyoruz.
--
-- `trustpilot_checked_at` BİLİNÇLİ OLARAK `trustpilot_domain`'den ayrı bir
-- kolon: `trustpilot_domain IS NULL` tek başına "bu işletme/rakip için
-- Trustpilot'a hiç bakmadık" ile "baktık ama Trustpilot'ta profili yok"
-- durumlarını ayırt edemez. Ayırt edilmezse, profili olmayan her rakip için
-- her analiz döngüsünde Trustpilot araması tekrar denenir ve gereksiz yere
-- Apify parası ödenir.
alter table public.businesses
  add column website text,
  add column trustpilot_domain text,
  add column trustpilot_checked_at timestamptz;

alter table public.competitors
  add column website text,
  add column trustpilot_domain text,
  add column trustpilot_checked_at timestamptz;

-- Yeni index/RLS policy/grant gerekmez: her iki tablonun da mevcut RLS'i ve
-- grant'ları satır bazlıdır (business_id/user_id üzerinden), yeni kolonlar
-- otomatik olarak aynı kapsamda kalır.
