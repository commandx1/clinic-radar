import { FREE_PLAN_ANALYSIS_COOLDOWN_DAYS, PRO_PLAN_ANALYSIS_COOLDOWN_DAYS } from "@/lib/constants";

// bkz. docs/02-business-rules.md Bölüm A — Free: ayda 1, Pro: haftalık analiz döngüsü
export function getNextAnalysisAvailableAt(lastScrapedAt: string | null, plan: string | undefined): Date | null {
  if (!lastScrapedAt) {
    return null;
  }
  const cooldownDays = plan === "pro" ? PRO_PLAN_ANALYSIS_COOLDOWN_DAYS : FREE_PLAN_ANALYSIS_COOLDOWN_DAYS;
  return new Date(new Date(lastScrapedAt).getTime() + cooldownDays * 24 * 60 * 60 * 1000);
}

export function isAnalysisCooldownActive(nextAnalysisAvailableAt: Date | null): boolean {
  return nextAnalysisAvailableAt !== null && nextAnalysisAvailableAt.getTime() > Date.now();
}
