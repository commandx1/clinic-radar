-- Haftalık özet / aylık rapor e-postaları için locale kaynağı yoktu; herkes
-- İngilizce alıyordu (bkz. weekly-digest.ts eski TODO ve
-- docs/11-risks-assumptions.md Risk 1). UI'daki dil değiştirici artık seçimi
-- NEXT_LOCALE çerezine ek olarak buraya da yazar; cron e-postaları bu sütunu
-- okur. Mevcut kullanıcılar defaultLocale ('en') ile kalır.
alter table public.users
  add column preferred_locale text not null default 'en'
    check (preferred_locale in ('tr', 'en'));

-- Kullanıcı yalnızca kendi satırındaki locale'i güncelleyebilmeli.
-- (users tablosunda update policy yoktu; sadece bu ihtiyaç için ekleniyor.)
create policy "users update own locale" on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

grant update (preferred_locale) on public.users to authenticated;
