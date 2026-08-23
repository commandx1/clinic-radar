// Görev sonuç takibi (bkz. docs/09-task-engine.md "Görev sonuç takibi",
// docs/02-business-rules.md) — ürünün "işe yaradı mı?" kanıtı. Her görev,
// oluşturulduğu andaki ölçülebilir sinyal durumunu (`outcome_baseline`) ve her
// sonraki analiz döngüsündeki en güncel durumu (`outcome_latest`) saklar.
// Saf/test edilebilir modül — Supabase erişimi yapmaz (bkz.
// src/lib/analysis/task-outcomes.ts, execute-analysis.ts).
import { z } from "zod";

import type { AggregatedTheme } from "@/lib/ai-pipeline/aggregate-competitor-themes";
import { TASK_MENTION_THRESHOLD, THEME_TREND_DELTA_THRESHOLD } from "@/lib/constants";
import { findSimilarTheme, normalizeTheme } from "@/lib/task-engine/theme-similarity";

export type OutcomeMetric =
  | {
      kind: "theme";
      theme: string;
      positive: number;
      negative: number;
      negative_ratio: number;
      absent: boolean;
      measured_at: string;
      window_days: number;
    }
  | {
      kind: "reply_rate";
      total: number;
      replied: number;
      rate: number;
      measured_at: string;
      window_days: number;
    }
  | {
      kind: "website";
      has_website: boolean;
      measured_at: string;
    };

export type OutcomeVerdict = "improved" | "worsened" | "flat";

const themeOutcomeSchema = z.object({
  kind: z.literal("theme"),
  theme: z.string(),
  positive: z.number(),
  negative: z.number(),
  negative_ratio: z.number(),
  absent: z.boolean(),
  measured_at: z.string(),
  window_days: z.number(),
});

const replyRateOutcomeSchema = z.object({
  kind: z.literal("reply_rate"),
  total: z.number(),
  replied: z.number(),
  rate: z.number(),
  measured_at: z.string(),
  window_days: z.number(),
});

const websiteOutcomeSchema = z.object({
  kind: z.literal("website"),
  has_website: z.boolean(),
  measured_at: z.string(),
});

const outcomeMetricSchema = z.discriminatedUnion("kind", [
  themeOutcomeSchema,
  replyRateOutcomeSchema,
  websiteOutcomeSchema,
]);

// tasks.outcome_baseline/outcome_latest (jsonb) okurken kullanılır — şema
// uyuşmazlığında (eski/bozuk veri) sessizce null döner, asla yarım/yanlış
// veri UI'a sızmaz (bkz. CLAUDE.md "AI pipeline değişikliklerinde şema
// validasyonu" ilkesiyle aynı ruh, burada AI çıktısı değil ama aynı temkinli
// okuma deseni uygulanıyor).
export function parseOutcomeMetric(json: unknown): OutcomeMetric | null {
  if (json === null || json === undefined) {
    return null;
  }
  const result = outcomeMetricSchema.safeParse(json);
  return result.success ? result.data : null;
}

export interface BuildOutcomeMetricContext {
  ownAggregated: AggregatedTheme[];
  ownReply: { total: number; replied: number };
  ownWebsite: string | null;
  measuredAt: string;
  windowDays: number;
}

// bkz. docs/02-business-rules.md Bölüm D — üç görev kaynağı: tema-tabanlı
// (`competitive_gap`/`absolute_quality`, theme_summary'den eşleştirilir) ve
// profil farkı (`profile:reply_rate` / `profile:website`, sabit tema
// anahtarları). Tema eşleşmesi ÖNCE normalizeTheme (exact) ile, bulunamazsa
// findSimilarTheme (fuzzy güvenlik ağı, bkz. theme-similarity.ts) ile
// denenir — model bir temayı döngüler arasında hafifçe farklı adlandırırsa
// (ör. "bekleme süresi" → "bekleme sürecinde") görev sahte bir "absent"a
// (ve dolayısıyla sahte bir "improved" verdict'ine, bkz. compareOutcome)
// düşmesin. Bu, trend hesabıyla (execute-analysis.ts computeTrend) VE
// reopen.ts'in reopen tetikleyicisiyle KASITLI OLARAK AYRIŞIYOR — onlar
// (Faz 2.8'de bilinçli olarak değiştirilmeyen trend/scoring semantiği) hâlâ
// sadece exact match kullanır.
export function buildOutcomeMetric(
  task: { theme: string | null; source_type: string },
  ctx: BuildOutcomeMetricContext,
): OutcomeMetric | null {
  if (task.theme === "profile:reply_rate") {
    const rate = ctx.ownReply.total > 0 ? ctx.ownReply.replied / ctx.ownReply.total : 0;
    return {
      kind: "reply_rate",
      total: ctx.ownReply.total,
      replied: ctx.ownReply.replied,
      rate,
      measured_at: ctx.measuredAt,
      window_days: ctx.windowDays,
    };
  }

  if (task.theme === "profile:website") {
    return {
      kind: "website",
      has_website: Boolean(ctx.ownWebsite && ctx.ownWebsite.trim() !== ""),
      measured_at: ctx.measuredAt,
    };
  }

  if (task.source_type !== "competitive_gap" && task.source_type !== "absolute_quality") {
    return null;
  }
  if (!task.theme) {
    return null;
  }

  const normalized = normalizeTheme(task.theme);
  let match = ctx.ownAggregated.find((t) => normalizeTheme(t.theme) === normalized);

  if (!match) {
    const similarLabel = findSimilarTheme(
      task.theme,
      ctx.ownAggregated.map((t) => t.theme),
    );
    match = similarLabel ? ctx.ownAggregated.find((t) => t.theme === similarLabel) : undefined;
  }

  if (!match) {
    return {
      kind: "theme",
      theme: task.theme,
      positive: 0,
      negative: 0,
      negative_ratio: 0,
      absent: true,
      measured_at: ctx.measuredAt,
      window_days: ctx.windowDays,
    };
  }

  const total = match.positive_mentions + match.negative_mentions;
  return {
    kind: "theme",
    theme: task.theme,
    positive: match.positive_mentions,
    negative: match.negative_mentions,
    negative_ratio: total > 0 ? match.negative_mentions / total : 0,
    absent: false,
    measured_at: ctx.measuredAt,
    window_days: ctx.windowDays,
  };
}

// bkz. docs/09-task-engine.md "Görev sonuç takibi" — verdict eşikleri
// THEME_TREND_DELTA_THRESHOLD/TASK_MENTION_THRESHOLD'ı reuse eder (ayrı bir
// sabit ailesi açmaya gerek yok, aynı "10 yüzde puanı"/"3 mention" gürültü
// toleransı burada da geçerli).
export function compareOutcome(baseline: OutcomeMetric | null, latest: OutcomeMetric | null): OutcomeVerdict | null {
  if (!baseline || !latest) {
    return null;
  }
  if (baseline.kind !== latest.kind) {
    return null;
  }

  if (baseline.kind === "theme" && latest.kind === "theme") {
    const improved =
      latest.negative_ratio <= baseline.negative_ratio - THEME_TREND_DELTA_THRESHOLD ||
      (latest.absent && baseline.negative >= TASK_MENTION_THRESHOLD);
    if (improved) {
      return "improved";
    }
    if (latest.negative_ratio >= baseline.negative_ratio + THEME_TREND_DELTA_THRESHOLD) {
      return "worsened";
    }
    return "flat";
  }

  if (baseline.kind === "reply_rate" && latest.kind === "reply_rate") {
    if (latest.rate - baseline.rate >= THEME_TREND_DELTA_THRESHOLD) {
      return "improved";
    }
    if (baseline.rate - latest.rate >= THEME_TREND_DELTA_THRESHOLD) {
      return "worsened";
    }
    return "flat";
  }

  // website (kind uyuşmazlığı fonksiyon başında elenmişti, geriye sadece
  // baseline.kind === "website" && latest.kind === "website" kalır).
  if (baseline.kind === "website" && latest.kind === "website" && !baseline.has_website && latest.has_website) {
    return "improved";
  }
  return "flat";
}
