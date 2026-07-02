import { z } from "zod";

export const createBusinessSchema = z.object({
  name: z.string().trim().min(1),
  google_place_id: z.string().trim().min(1),
  category: z.string().trim().min(1).optional(),
});

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;
