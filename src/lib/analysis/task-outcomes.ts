import type { SupabaseClient } from "@supabase/supabase-js";

import { buildOutcomeMetric, type BuildOutcomeMetricContext } from "@/lib/task-engine/task-outcome";
import type { Database, Json } from "@/types/database.types";

type AnalysisSupabaseClient = SupabaseClient<Database>;

interface TaskOutcomeRow {
  id: string;
  theme: string | null;
  source_type: string;
  outcome_baseline: Json | null;
}

// bkz. docs/09-task-engine.md "Görev sonuç takibi" — her analiz döngüsünde
// upsertTasks'tan SONRA çağrılır (execute-analysis.ts runAnalysisPipeline).
// Yeni oluşturulan görevler zaten insert sırasında outcome_baseline almıştır
// (upsertTasks); burada TÜM open/done görevler için outcome_latest güncellenir.
// Migration ÖNCESİ oluşmuş görevlerde (outcome_baseline hâlâ null) baseline de
// bu ilk ölçümle doldurulur — geriye dönük veri yok, ilk gördüğümüz an baseline
// kabul edilir. `dismissed` görevler kapsam dışı (kullanıcı için artık aktif
// değil, sonuç takibi anlamsız).
export async function refreshTaskOutcomes(
  supabase: AnalysisSupabaseClient,
  businessId: string,
  ctx: BuildOutcomeMetricContext,
): Promise<{ refreshed: number }> {
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id, theme, source_type, outcome_baseline")
    .eq("business_id", businessId)
    .in("status", ["open", "done"]);

  let refreshed = 0;
  for (const task of (tasks ?? []) as TaskOutcomeRow[]) {
    const latest = buildOutcomeMetric(task, ctx);
    if (!latest) {
      continue;
    }

    const update: { outcome_latest: Json; outcome_baseline?: Json } = {
      outcome_latest: latest,
    };
    if (task.outcome_baseline === null) {
      update.outcome_baseline = latest;
    }

    const { error } = await supabase.from("tasks").update(update).eq("id", task.id);
    if (error) {
      console.error("Görev outcome_latest güncellenemedi:", error);
      continue;
    }
    refreshed += 1;
  }

  return { refreshed };
}
