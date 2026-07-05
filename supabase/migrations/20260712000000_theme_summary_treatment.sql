-- ============ Treatments Kırılımı (Faz 2) ============
-- bkz. docs/10-roadmap.md Faz 2, docs/08-dashboard.md
--
-- Aşama 1 çıktısına eklenen opsiyonel `treatment` alanı (tema ilişkili
-- olduğu tedavi/hizmet türü — implant, ortodonti, botoks vb.; kategoriden
-- bağımsız serbest metin, kapalı bir liste değil). Tema genel bir konuyla
-- ilgiliyse (ör. "bekleme süresi", "resepsiyon nezaketi") null kalır.
alter table public.theme_summary
  add column treatment text;
