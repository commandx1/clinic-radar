-- ============ Fırsat tahmini kartı — opsiyonel iş girdileri ============
-- bkz. docs/08-dashboard.md "Fırsat tahmini" kartı, docs/09-task-engine.md
-- "Opportunity Estimate". İkisi de opsiyoneldir: doldurulmazsa kart sadece
-- puan/hız kıyaslamasını (bant halinde) gösterir, $ tahmini için kullanıcının
-- bilinçli olarak girmesi gerekir — hiçbir varsayılan değer/tahmin yapılmaz.
--
-- DB'de nullable, uygulama katmanında da zorunluluk yok (createBusinessSchema
-- akışının aksine — current_tool gibi onboarding'de sorulmuyor, sadece edit
-- formunda opsiyonel iki alan). Değerler asla dışarı paylaşılmaz, yalnızca
-- kod tarafında $ bandı hesaplamak için okunur (src/lib/task-engine/opportunity-estimate.ts).
--
-- RLS: businesses'ın mevcut owner policy'leri satır bazlı olduğu için yeni
-- kolonları da kapsar; ek policy/grant gerekmez.

alter table public.businesses
  add column avg_patient_value_usd numeric null check (avg_patient_value_usd >= 0),
  add column monthly_new_patients integer null check (monthly_new_patients >= 0);
