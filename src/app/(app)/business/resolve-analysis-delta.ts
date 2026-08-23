import type { AnalysisDelta } from "@/lib/analysis/analysis-delta";
import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface ResolvedAnalysisDelta {
  delta: AnalysisDelta;
  runFinishedAt: string;
}

// bkz. docs/08-dashboard.md "Bu analizde ne değişti" kartı — Overview'da
// gösterilecek en güncel delta. Sadece succeeded/partial run'lar delta taşır
// (bkz. execute-analysis.ts, analysis-delta.ts); running/failed run'larda
// kolon null'dır, bu yüzden `not("delta", "is", null)` filtresi otomatik
// olarak onları dışarıda bırakır — status filtresine ayrıca gerek yok.
export async function resolveAnalysisDelta(
  supabase: SupabaseClient,
  businessId: string,
): Promise<ResolvedAnalysisDelta | null> {
  const { data } = await supabase
    .from("analysis_runs")
    .select("delta, finished_at")
    .eq("business_id", businessId)
    .not("delta", "is", null)
    .order("finished_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.delta || !data.finished_at) {
    return null;
  }

  return { delta: data.delta as unknown as AnalysisDelta, runFinishedAt: data.finished_at };
}
