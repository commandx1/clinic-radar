import { normalizeTheme } from "@/lib/task-engine/reopen";

import {
  resolveCompetitorNames,
  toTaskCardData,
  type SupabaseClient,
  type ThemeCompetitorBreakdownLookup,
  type ThemeSummaryLookup,
} from "./resolve-tasks-shared";
import type { TaskListItem } from "./task-list";

// priority sırasına göre (high→medium→low), sonra impact/effort oranına göre
// azalan sırala — bkz. docs/09-task-engine.md (Opportunity Score = impact/effort'tan türer).
const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

// Görev kartındaki kanıt satırı için theme_summary'den own/competitor mention
// sayılarını tema bazında lookup'a çevirir (bkz. resolve-tasks-shared.ts computeEvidence).
// Yalnızca competitor_id IS NULL (toplulaştırılmış) satırları okur — davranış DEĞİŞMEDİ.
async function resolveThemeSummaryLookup(
  supabase: SupabaseClient,
  businessId: string,
): Promise<ThemeSummaryLookup> {
  const { data: summaryRows } = await supabase
    .from("theme_summary")
    .select("owner_type, theme, positive_mentions, negative_mentions")
    .eq("business_id", businessId)
    .is("competitor_id", null)
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

// bkz. docs/10-roadmap.md Faz 1.2 madde 3 — rakip bazlı (competitor_id dolu)
// satırlardan, tema başına "kaç rakipte güçlü / toplam kaç rakip" kırılımını
// çıkarır. "Güçlü" = positive > negative. Görev kartındaki
// "N rakibinden M'i güçlü" satırı için; skorlamayı etkilemez.
async function resolveThemeCompetitorBreakdownLookup(
  supabase: SupabaseClient,
  businessId: string,
): Promise<ThemeCompetitorBreakdownLookup> {
  const { data: rows } = await supabase
    .from("theme_summary")
    .select("theme, positive_mentions, negative_mentions")
    .eq("business_id", businessId)
    .eq("owner_type", "competitor")
    .not("competitor_id", "is", null);

  const lookup: ThemeCompetitorBreakdownLookup = new Map();
  for (const row of rows ?? []) {
    if (!row.theme) {
      continue;
    }
    const key = normalizeTheme(row.theme);
    const existing = lookup.get(key) ?? { strongCount: 0, totalCount: 0 };
    existing.totalCount += 1;
    if (row.positive_mentions > row.negative_mentions) {
      existing.strongCount += 1;
    }
    lookup.set(key, existing);
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
      "id, title_i18n, description_i18n, theme, priority, impact_score, effort_score, based_on_competitor_id, source_type, checklist_i18n",
    )
    .eq("business_id", businessId)
    .eq("status", "open");

  const [competitorNameById, themeSummaryLookup, competitorBreakdownLookup] = await Promise.all([
    resolveCompetitorNames(supabase, openTasks ?? []),
    resolveThemeSummaryLookup(supabase, businessId),
    resolveThemeCompetitorBreakdownLookup(supabase, businessId),
  ]);

  return (openTasks ?? [])
    .map((task) => ({
      id: task.id,
      ...toTaskCardData(task, locale, competitorNameById, themeSummaryLookup, competitorBreakdownLookup),
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
