import { normalizeTheme } from "@/lib/task-engine/reopen";

import {
  resolveCompetitorNames,
  toTaskCardData,
  type SupabaseClient,
  type ThemeSummaryLookup,
} from "./resolve-tasks-shared";
import type { TaskListItem } from "./task-list";

// priority sırasına göre (high→medium→low), sonra impact/effort oranına göre
// azalan sırala — bkz. docs/09-task-engine.md (Opportunity Score = impact/effort'tan türer).
const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

// Görev kartındaki kanıt satırı için theme_summary'den own/competitor mention
// sayılarını tema bazında lookup'a çevirir (bkz. resolve-tasks-shared.ts computeEvidence).
async function resolveThemeSummaryLookup(
  supabase: SupabaseClient,
  businessId: string,
): Promise<ThemeSummaryLookup> {
  const { data: summaryRows } = await supabase
    .from("theme_summary")
    .select("owner_type, theme, positive_mentions, negative_mentions")
    .eq("business_id", businessId)
    .in("owner_type", ["own", "competitor"]);

  const lookup: ThemeSummaryLookup = new Map();
  for (const row of summaryRows ?? []) {
    if (!row.theme) {
      continue;
    }
    lookup.set(`${row.owner_type}|${normalizeTheme(row.theme)}`, {
      positive: row.positive_mentions,
      negative: row.negative_mentions,
    });
  }
  return lookup;
}

export async function resolveOpenTasks(
  supabase: SupabaseClient,
  businessId: string,
  locale: string,
): Promise<TaskListItem[]> {
  const { data: openTasks } = await supabase
    .from("tasks")
    .select(
      "id, title_i18n, description_i18n, theme, priority, impact_score, effort_score, based_on_competitor_id, source_type",
    )
    .eq("business_id", businessId)
    .eq("status", "open");

  const [competitorNameById, themeSummaryLookup] = await Promise.all([
    resolveCompetitorNames(supabase, openTasks ?? []),
    resolveThemeSummaryLookup(supabase, businessId),
  ]);

  return (openTasks ?? [])
    .map((task) => ({
      id: task.id,
      ...toTaskCardData(task, locale, competitorNameById, themeSummaryLookup),
    }))
    .sort((a, b) => {
      const priorityDiff = (PRIORITY_ORDER[a.priority ?? ""] ?? 3) - (PRIORITY_ORDER[b.priority ?? ""] ?? 3);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      const aRatio = (a.impact_score ?? 0) / (a.effort_score ?? 1);
      const bRatio = (b.impact_score ?? 0) / (b.effort_score ?? 1);
      return bRatio - aRatio;
    });
}
