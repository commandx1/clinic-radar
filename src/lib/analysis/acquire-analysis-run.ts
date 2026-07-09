import { type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

type RunSupabaseClient = SupabaseClient<Database>;

// Bir 'running' koşunun bu süreden daha eski kalması, onu başlatan serverless
// invocation'ının zaman aşımına uğradığı (Vercel maxDuration = 300s) anlamına
// gelir. Reaper böyle satırları 'failed' işaretler ki eşzamanlılık kilidi
// (analysis_runs_one_running_per_business) işletmeyi kalıcı olarak kilitlemesin.
const STALE_RUNNING_MS = 15 * 60 * 1000;

export type AcquireRunResult =
  | { ok: true; runId: string | null }
  | { ok: false; reason: "already_running" };

// bkz. supabase/migrations/20260717000000_analysis_runs_lock_and_partial.sql
// Partial unique index sayesinde işletme başına tek 'running' koşu garantidir;
// ikinci insert 23505 döner ve "already_running" olarak raporlanır. Bu, çift
// tıklama ya da manuel + cron çakışmasının 2x Apify/Claude maliyeti üretmesini
// engeller. runId null dönerse (unique dışı DB hatası) çağıran taraf koşuyu
// yine de yürütür ama kayıt tutamaz — analiz kaybı yerine izlenebilirlik kaybı.
export async function acquireAnalysisRun(
  supabase: RunSupabaseClient,
  businessId: string,
  trigger: "manual" | "cron",
): Promise<AcquireRunResult> {
  const staleCutoff = new Date(Date.now() - STALE_RUNNING_MS).toISOString();
  await supabase
    .from("analysis_runs")
    .update({
      status: "failed",
      error: "stale_timeout",
      finished_at: new Date().toISOString(),
    })
    .eq("business_id", businessId)
    .eq("status", "running")
    .lt("started_at", staleCutoff);

  const { data, error } = await supabase
    .from("analysis_runs")
    .insert({ business_id: businessId, trigger, status: "running" })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { ok: false, reason: "already_running" };
    }
    console.error("analysis_runs kaydı oluşturulamadı:", error);
    return { ok: true, runId: null };
  }

  return { ok: true, runId: data.id };
}
