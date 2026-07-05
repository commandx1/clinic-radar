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
