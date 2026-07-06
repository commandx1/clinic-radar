import { FREE_PLAN_MAX_COMPETITORS, PRO_PLAN_MAX_COMPETITORS } from "@/lib/constants";

export const FREE_PLAN_PRICE_USD = 0;
export const PRO_PLAN_PRICE_USD = 29;

export const PRICING_PLAN_LIMITS = {
  free: { maxCompetitors: FREE_PLAN_MAX_COMPETITORS },
  pro: { maxCompetitors: PRO_PLAN_MAX_COMPETITORS },
} as const;
