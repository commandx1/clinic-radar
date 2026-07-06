-- ============ LemonSqueezy Billing Alanları ============
-- bkz. docs/03-database.md, docs/04-api.md (POST /api/webhooks/billing)
--
-- Webhook (src/app/api/webhooks/billing/route.ts) subscription_created
-- olayında custom_data.user_id ile eşleşen satırı, sonraki olaylarda
-- lemonsqueezy_subscription_id ile eşleşen satırı günceller.
alter table public.subscriptions
  add column lemonsqueezy_customer_id text,
  add column lemonsqueezy_subscription_id text unique,
  add column lemonsqueezy_variant_id text,
  add column lemonsqueezy_customer_portal_url text;

-- Aynı GRANT/RLS ayrımı bug'ı (bkz. 20260711000000_service_role_grants.sql):
-- rolbypassrls sadece RLS'i atlar, tablo GRANT'ını atlamaz. Webhook route'u
-- kullanıcı oturumu olmadan çalıştığı için admin client (service_role)
-- kullanır ve bu satırı UPDATE etmesi gerekir.
grant update on public.subscriptions to service_role;
