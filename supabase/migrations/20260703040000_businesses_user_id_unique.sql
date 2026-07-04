-- Free plan: kullanıcı başına 1 işletme — bkz. docs/02-business-rules.md Bölüm A.
-- Öncesinde user_id üzerinde bir kısıt yoktu, POST /api/business tekrar
-- çağrılırsa aynı kullanıcı için ikinci bir satır oluşabiliyordu.

alter table public.businesses add constraint businesses_user_id_key unique (user_id);
