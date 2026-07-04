import { resolveCompetitorNames, toTaskCardData, type SupabaseClient } from "./resolve-tasks-shared";
import type { TaskHistoryItem } from "./task-history-list";

export async function resolveTaskHistory(
  supabase: SupabaseClient,
  businessId: string,
  locale: string,
): Promise<TaskHistoryItem[]> {
  const { data: historyTasks } = await supabase
    .from("tasks")
    .select(
      "id, title_i18n, description_i18n, theme, priority, impact_score, effort_score, based_on_competitor_id, status, completed_at, created_at",
    )
    .eq("business_id", businessId)
    .in("status", ["done", "dismissed"]);

  const competitorNameById = await resolveCompetitorNames(supabase, historyTasks ?? []);
  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return (historyTasks ?? [])
    .map((task) => ({
      id: task.id,
      ...toTaskCardData(task, locale, competitorNameById),
      status: task.status as TaskHistoryItem["status"],
      // dismissed görevlerin özel bir timestamp'i yok (docs/03-database.md) —
      // tarih etiketi sadece done görevlerde gösterilir, sıralama için created_at'a düşülür.
      resolvedAt: task.completed_at ?? task.created_at,
      completedAtLabel: task.completed_at ? dateFormatter.format(new Date(task.completed_at)) : null,
    }))
    .sort((a, b) => (a.resolvedAt < b.resolvedAt ? 1 : -1));
}
