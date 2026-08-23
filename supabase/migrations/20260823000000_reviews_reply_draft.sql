-- ============ Yorum yanıt taslağı (Review Reply Assistant) ============
-- bkz. docs/02-business-rules.md Bölüm J, docs/03-database.md, docs/04-api.md
--
-- Tek mantıksal değişiklik: kullanıcının kendi (owner_type='own') yanıtlanmamış
-- yorumları için AI'ın ürettiği taslak yanıtı ve kullanıcının "yanıtladım"
-- işaretini saklamak. Ham yorum metni gibi bu alanlar da UI'da olduğu gibi
-- gösterilebilir (owner_reply ile aynı görünürlük sınıfı — kullanıcının kendi
-- yazacağı/düzenleyeceği bir taslak, "birebir alıntı" kısıtı reviews.text'e
-- özgü, bkz. CLAUDE.md).
alter table public.reviews
  add column reply_draft text,
  add column reply_draft_generated_at timestamptz,
  add column reply_marked_at timestamptz;

-- Not: reviews üzerinde owner için bir UPDATE policy'si + authenticated grant'ı
-- zaten var (20260703000000_reviews_write_policy.sql: "reviews update own",
-- is_review_owner(business_id, owner_type) ile own/competitor'ı ayırt eder;
-- grant kolon bazlı değil tablo bazlı, yeni kolonlar otomatik kapsanır). Bu
-- migration'da yeni bir RLS policy/grant eklemeye gerek yok.
