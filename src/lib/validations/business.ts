import { z } from "zod";

export const createBusinessSchema = z.object({
  name: z.string().trim().min(1),
  google_place_id: z.string().trim().min(1),
  category: z.string().trim().min(1).optional(),
  // Onboarding'de ZORUNLU soru — "şu an rakip/itibar takibi için ne
  // kullanıyorsunuz?" (bkz. docs/11-risks-assumptions.md Bölüm B/E, Birdeye
  // churn sinyali). DB kolonu nullable'dır (eski satırlar), zorunluluk burada.
  current_tool: z.string().trim().min(1),
});

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;

// İşletme düzenleme (PATCH). Tüm alanlar opsiyonel ama en az biri zorunlu —
// aksi halde no-op bir istek boş bir güncelleme tetiklemesin. google_place_id
// değişirse route yeniden Apify enrichment tetikler (lat/lng/rating vb.).
export const updateBusinessSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    google_place_id: z.string().trim().min(1).optional(),
    category: z.string().trim().min(1).optional(),
    current_tool: z.string().trim().min(1).optional(),
    // Trustpilot domain'inin elle düzeltilmesi — bkz. trustpilot-domain.ts
    // `normalizeTrustpilotDomainInput`. Kasıtlı olarak `.trim().min(1)` YOK:
    // boş string GEÇERLİ bir değer, "eşleşmeyi temizle" anlamına gelir (bkz.
    // route.ts). Sadece Pro planlı kullanıcılar gönderebilir (route'ta 403).
    trustpilot_domain_override: z.string().optional(),
    // Fırsat tahmini kartı için opsiyonel iş girdileri (bkz.
    // docs/09-task-engine.md "Opportunity Estimate", opportunity-estimate.ts).
    // `.nullable()` bilinçli: kullanıcı daha önce girdiği bir değeri
    // temizleyebilmeli (boş input -> null gönderilir, bkz. use-business-edit-form.ts).
    avg_patient_value_usd: z.number().min(0).nullable().optional(),
    monthly_new_patients: z.number().int().min(0).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    error: "at_least_one_field_required",
  });

export type UpdateBusinessInput = z.infer<typeof updateBusinessSchema>;
