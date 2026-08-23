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

// bkz. docs/09-task-engine.md "Görev sonuç takibi" — iki tema kaynağının
// ("competitive_gap"/"absolute_quality") sonuç sinyali TERSTİR: absolute_quality
// için "işe yaradı" = own negatif oranın düşmesi/temanın kaybolması;
// competitive_gap için görev TANIM GEREĞİ own tarafında zaten "absent"
// (rakip güçlü, klinik bu konuda zaten sessiz) başlar, o yüzden "işe yaradı" =
// own OLUMLU mention'ların başlaması/artması. `source_type` metric üzerinde
// saklanır ki `compareOutcome` (baseline/latest'ten başka context almaz)
// doğru yöne bakabilsin.
export type ThemeOutcomeSourceType = "competitive_gap" | "absolute_quality";

export type OutcomeMetric =
  | {
      kind: "theme";
      theme: string;
      positive: number;
      negative: number;
      negative_ratio: number;
      positive_ratio: number;
      absent: boolean;
      source_type: ThemeOutcomeSourceType;
      // Bu ölçümün alındığı döngüde own Aşama 1'in ürettiği TOPLAM (aggregate)
      // tema sayısı — bu temanın kendisiyle eşleşip eşleşmediğinden bağımsız.
      // 0 ise own analiz bu döngüde hiçbir şey üretmedi demektir (own Aşama 1
      // başarısız oldu ya da gerçekten hiç tekrar eden tema yok) — bu durumda
      // "absent" güvenilir bir "kayboldu" sinyali DEĞİLDİR, sadece "ölçemedik"
      // demektir. `compareOutcome` bu ayrımı yapmak için kullanır (bkz. aşağı).
      own_theme_count: number;
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

// Eski (Faz 2.6-2.8) satırlarda `positive_ratio`/`source_type`/`own_theme_count`
// yok — bu üç alan burada opsiyonel bırakılır, `parseOutcomeMetric` eksik
// olanları güvenli varsayılanlarla doldurur (asla crash etmez, bkz. CLAUDE.md
// "eski format çalışmaya devam etmeli").
const themeOutcomeSchema = z.object({
  kind: z.literal("theme"),
  theme: z.string(),
  positive: z.number(),
  negative: z.number(),
  negative_ratio: z.number(),
  positive_ratio: z.number().optional(),
  absent: z.boolean(),
  source_type: z.enum(["competitive_gap", "absolute_quality"]).optional(),
  own_theme_count: z.number().optional(),
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
  if (!result.success) {
    return null;
  }
  const data = result.data;
  if (data.kind !== "theme") {
    return data;
  }

  // bkz. yukarıdaki şema notu — eski satırlarda eksik alanlar için varsayılan:
  // `source_type` eksikse önceki (tek) davranış olan absolute_quality kabul
  // edilir; `own_theme_count` eksikse 0 kabul edilir — bu BİLİNÇLİ OLARAK
  // temkinli bir varsayımdır: 0, compareOutcome'da "bu döngü için ölçüm yok"
  // anlamına gelir (verdict null, satır gizlenir), yani bilinmeyen eski
  // veride sahte bir "improved" göstermek yerine sessiz kalmayı tercih eder.
  const total = data.positive + data.negative;
  return {
    kind: "theme",
    theme: data.theme,
    positive: data.positive,
    negative: data.negative,
    negative_ratio: data.negative_ratio,
    positive_ratio: data.positive_ratio ?? (total > 0 ? data.positive / total : 0),
    absent: data.absent,
    source_type: data.source_type ?? "absolute_quality",
    own_theme_count: data.own_theme_count ?? 0,
    measured_at: data.measured_at,
    window_days: data.window_days,
  };
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

  // bkz. yukarıdaki OutcomeMetric "own_theme_count" notu — own Aşama 1'in bu
  // döngüde ürettiği TOPLAM tema sayısı, bu temanın kendisiyle eşleşip
  // eşleşmediğinden bağımsız olarak donar. 0 ise own analiz bu döngü hiçbir
  // şey ölçmedi demektir (compareOutcome bunu "işe yaradı" ile "ölçemedik"i
  // ayırt etmek için kullanır).
  const ownThemeCount = ctx.ownAggregated.length;
  const sourceType = task.source_type;

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
      positive_ratio: 0,
      absent: true,
      source_type: sourceType,
      own_theme_count: ownThemeCount,
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
    positive_ratio: total > 0 ? match.positive_mentions / total : 0,
    absent: false,
    source_type: sourceType,
    own_theme_count: ownThemeCount,
    measured_at: ctx.measuredAt,
    window_days: ctx.windowDays,
  };
}

type ThemeOutcomeMetric = Extract<OutcomeMetric, { kind: "theme" }>;

// absolute_quality — "işe yaradı" own NEGATİF oranın düşmesi/temanın
// kaybolmasıdır (Faz 2.6-2.8 semantiği, DEĞİŞMEDİ). Tek fark: eski "tema
// tamamen kayboldu ⇒ improved" kısayolu artık own_theme_count > 0 şartına
// bağlı — bkz. docs/09-task-engine.md "Görev sonuç takibi" ve pilot false
// positive vakası (own_theme_count=0 iken absent, gerçek bir "kayboldu"
// sinyali değil "bu döngü hiç ölçemedik" demektir).
function compareAbsoluteQualityTheme(baseline: ThemeOutcomeMetric, latest: ThemeOutcomeMetric): OutcomeVerdict | null {
  if (latest.absent) {
    if (latest.own_theme_count === 0) {
      return null;
    }
    if (baseline.negative >= TASK_MENTION_THRESHOLD) {
      return "improved";
    }
  }
  if (latest.negative_ratio <= baseline.negative_ratio - THEME_TREND_DELTA_THRESHOLD) {
    return "improved";
  }
  if (latest.negative_ratio >= baseline.negative_ratio + THEME_TREND_DELTA_THRESHOLD) {
    return "worsened";
  }
  return "flat";
}

// competitive_gap — görev TANIM GEREĞİ own tarafında "rakip güçlü, klinik bu
// konuda zayıf/sessiz" olduğu için oluşturulur; own negatif oran genelde
// hiç anlamlı değildir (bkz. docs/09-task-engine.md). Sinyal own OLUMLU
// mention'ların başlaması/artmasıdır. Her iki tarafta da own hiç mention
// almadıysa gösterilecek bir şey yoktur (anlamsız "%0 → %0" satırı yerine
// null — satır UI'da hiç render edilmez).
function compareCompetitiveGapTheme(baseline: ThemeOutcomeMetric, latest: ThemeOutcomeMetric): OutcomeVerdict | null {
  if (baseline.positive === 0 && latest.positive === 0) {
    return null;
  }
  if (latest.positive >= TASK_MENTION_THRESHOLD && latest.positive - baseline.positive >= TASK_MENTION_THRESHOLD) {
    return "improved";
  }
  if (baseline.positive - latest.positive >= TASK_MENTION_THRESHOLD) {
    return "worsened";
  }
  return "flat";
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
    // bkz. yukarıdaki iki yardımcı fonksiyon — hangi yöne bakılacağı `latest`
    // üzerindeki source_type'a göre belirlenir (görevin kendi kimliği, bir
    // döngüden diğerine DEĞİŞMEZ; latest kullanılır çünkü eski satırlarda
    // baseline'ın source_type'ı hiç yazılmamış olabilir — bkz. parseOutcomeMetric
    // varsayılanı — latest her zaman en güncel/doğru değeri taşır).
    return latest.source_type === "competitive_gap"
      ? compareCompetitiveGapTheme(baseline, latest)
      : compareAbsoluteQualityTheme(baseline, latest);
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
