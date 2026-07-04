import type { BilingualText } from "@/lib/ai-pipeline/gap-analysis-schema";
import type { createClient } from "@/lib/supabase/server";
import { normalizeTheme } from "@/lib/task-engine/reopen";
import type { Json } from "@/types/database.types";

import type { TaskCardData, TaskEvidence } from "./task-card-body";

export type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// theme_summary satırlarından türetilen kanıt satırı için lookup — key: `${owner_type}|${normalizeTheme(theme)}`.
// bkz. resolve-open-tasks.ts.
export interface ThemeSummaryCounts {
  positive: number;
  negative: number;
}

export type ThemeSummaryLookup = Map<string, ThemeSummaryCounts>;

export function pickLocale(value: Json, locale: string): string {
  const bilingual = value as unknown as BilingualText;
  return locale === "en" ? bilingual.en : bilingual.tr;
}

interface TaskRowBase {
  title_i18n: Json;
  description_i18n: Json | null;
  theme: string | null;
  priority: string | null;
  impact_score: number | null;
  effort_score: number | null;
  based_on_competitor_id: string | null;
  // DB kolonu `string` (bkz. database.types.ts) — gerçek değerler her zaman
  // "competitive_gap" | "absolute_quality", burada literal union'a daraltılır.
  source_type?: string | null;
}

type TaskSourceType = "competitive_gap" | "absolute_quality" | null;

function toSourceType(value: string | null | undefined): TaskSourceType {
  return value === "competitive_gap" || value === "absolute_quality" ? value : null;
}

// Görevin teması ile theme_summary'deki own/competitor satırlarını eşleştirir.
// Tema adı AI tarafından serbestçe üretildiği için normalizeTheme ile eşleştirilir;
// eşleşme yoksa (isim drift'i) kanıt satırı gizlenir — uydurma sayı gösterilmez.
function computeEvidence(
  task: TaskRowBase,
  themeSummaryLookup: ThemeSummaryLookup | undefined,
): TaskEvidence | undefined {
  if (!task.theme || !themeSummaryLookup) {
    return undefined;
  }
  const normalized = normalizeTheme(task.theme);
  const own = themeSummaryLookup.get(`own|${normalized}`);
  const competitor = themeSummaryLookup.get(`competitor|${normalized}`);
  const sourceType = toSourceType(task.source_type);

  if (sourceType === "competitive_gap") {
    if (!competitor) {
      return undefined;
    }
    return {
      ownPositive: own?.positive ?? 0,
      ownNegative: own?.negative ?? 0,
      competitorPositive: competitor.positive,
      competitorNegative: competitor.negative,
    };
  }

  if (sourceType === "absolute_quality") {
    if (!own) {
      return undefined;
    }
    return {
      ownPositive: own.positive,
      ownNegative: own.negative,
      competitorPositive: competitor?.positive ?? 0,
      competitorNegative: competitor?.negative ?? 0,
    };
  }

  return undefined;
}

export async function resolveCompetitorNames(
  supabase: SupabaseClient,
  tasks: Pick<TaskRowBase, "based_on_competitor_id">[],
): Promise<Map<string, string>> {
  const competitorIds = Array.from(
    new Set(tasks.flatMap((task) => (task.based_on_competitor_id ? [task.based_on_competitor_id] : []))),
  );
  if (competitorIds.length === 0) {
    return new Map();
  }
  const { data: competitorRows } = await supabase.from("competitors").select("id, name").in("id", competitorIds);
  return new Map((competitorRows ?? []).map((c) => [c.id, c.name]));
}

export function toTaskCardData(
  task: TaskRowBase,
  locale: string,
  competitorNameById: Map<string, string>,
  themeSummaryLookup?: ThemeSummaryLookup,
): TaskCardData {
  return {
    title: pickLocale(task.title_i18n, locale),
    description: task.description_i18n ? pickLocale(task.description_i18n, locale) : null,
    theme: task.theme,
    priority: task.priority,
    impact_score: task.impact_score,
    effort_score: task.effort_score,
    source_type: toSourceType(task.source_type),
    competitorName: task.based_on_competitor_id
      ? (competitorNameById.get(task.based_on_competitor_id) ?? null)
      : null,
    evidence: computeEvidence(task, themeSummaryLookup),
  };
}
