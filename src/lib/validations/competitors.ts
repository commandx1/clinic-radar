import { z } from "zod";

import { MAX_COMPETITORS, MIN_COMPETITORS } from "@/lib/constants";

export const discoverCandidateSchema = z.object({
  google_place_id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  rating: z.number().min(0).max(5).nullable(),
  review_count: z.number().int().min(0).nullable(),
});

export const discoverResponseSchema = z.object({
  candidates: z.array(discoverCandidateSchema),
  limited: z.boolean(),
});

export const selectCompetitorsSchema = z.object({
  candidates: z
    .array(discoverCandidateSchema)
    .min(MIN_COMPETITORS)
    .max(MAX_COMPETITORS),
});

export type DiscoverCandidate = z.infer<typeof discoverCandidateSchema>;
export type DiscoverResponse = z.infer<typeof discoverResponseSchema>;
export type SelectCompetitorsInput = z.infer<typeof selectCompetitorsSchema>;
