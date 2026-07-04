-- tasks.title/description tek dilliydi (o anki UI locale'ine göre üretiliyordu);
-- kullanıcı locale'i sonradan değiştirdiğinde eski task'lar retranslate edilmiyordu.
-- Artık Aşama 2 title/description'ı hem tr hem en üretiyor, jsonb {tr, en} olarak saklanıyor.
alter table public.tasks add column title_i18n jsonb;
alter table public.tasks add column description_i18n jsonb;

update public.tasks
  set title_i18n = jsonb_build_object('tr', title, 'en', title),
      description_i18n = case when description is not null
        then jsonb_build_object('tr', description, 'en', description) else null end;

alter table public.tasks alter column title_i18n set not null;
alter table public.tasks drop column title;
alter table public.tasks drop column description;
