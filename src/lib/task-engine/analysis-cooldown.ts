import {
  ANALYSIS_RUN_STALE_MS,
  FREE_PLAN_ANALYSIS_COOLDOWN_DAYS,
  PRO_PLAN_ANALYSIS_COOLDOWN_DAYS,
} from "@/lib/constants";

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

// bkz. src/lib/analysis/execute-analysis.ts — businesses.last_scraped_at, AI
// aşamalarından ÖNCE (scrape sonrası) yazılır. Vercel'in sert maxDuration=300
// sınırı fonksiyonu AI aşamalarında öldürebilir (ölçülen: own+3 rakip ~246-270s,
// bir withRetryOnce retry'ı sınırı kolayca aşar) — bu durumda last_scraped_at
// zaten yazılmış olur ama analiz asla tamamlanmaz, kullanıcı tüm cooldown
// penceresi boyunca (Free 30, Pro 7 gün) kilitli kalır ve harcanan Apify
// maliyeti boşa gider. Bu fonksiyon, işletmenin EN SON `analysis_runs`
// satırı gerçekten tamamlanmadıysa (failed, ya da stale eşiğini aşmış
// 'running' — yani başlatan invocation zaman aşımına uğramış) cooldown'ı
// atlamaya izin verir. Gerçekten devam eden taze bir 'running' koşusu ayrı
// bir mekanizmayla (acquireAnalysisRun'ın 409 analysis_already_running
// guard'ı) zaten korunuyor, o yüzden burada false döner — cooldown bloğu
// devam eder ama 409 guard onu yakalar.
export function isRetryAllowedAfterFailure(
  latestRun: { status: string; started_at: string } | null,
  now: Date = new Date(),
): boolean {
  if (!latestRun) {
    return false;
  }
  if (latestRun.status === "failed") {
    return true;
  }
  if (latestRun.status === "running") {
    const staleCutoff = now.getTime() - ANALYSIS_RUN_STALE_MS;
    return new Date(latestRun.started_at).getTime() < staleCutoff;
  }
  return false;
}
