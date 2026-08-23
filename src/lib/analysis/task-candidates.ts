import { type AggregatedTheme } from "@/lib/ai-pipeline/aggregate-competitor-themes";
import type { TaskCandidate, ThemeTrendInput } from "@/lib/ai-pipeline/provider";
import {
  ABSOLUTE_QUALITY_NEGATIVE_RATIO_THRESHOLD,
  TASK_MENTION_THRESHOLD,
} from "@/lib/constants";
import {
  computeAbsoluteQualityImpactScore,
  computeCompetitiveGapImpactScore,
  type ImpactScoreBreakdown,
  type ThemeTrend,
} from "@/lib/task-engine/impact-score";
import { normalizeTheme } from "@/lib/task-engine/reopen";
import { findSimilarTheme } from "@/lib/task-engine/theme-similarity";

// bkz. docs/05-ai-pipeline.md "tema kanonikleştirme", docs/06-prompts.md
// Aşama 2 — promptta "theme alanını verilen listelerden birebir kopyala"
// kuralı istense de modele asla güvenilmez (bkz. CLAUDE.md); Aşama 2 çıktısı
// filterCandidates'a girmeden ÖNCE burada kod tarafında zorlanır. Her adayın
// `theme`'i own+rakip AGREGAT etiketlerinin birleşiminde ÖNCE tam (normalize
// edilmiş) eşleşmeyle, bulunamazsa `findSimilarTheme` (theme-similarity.ts,
// aynı fuzzy güvenlik ağı upsertTasks/buildOutcomeMetric'te kullanılan) ile
// aranır; ikisi de kaçarsa aday olduğu gibi bırakılır (yeni, gerçekten farklı
// bir tema olabilir — zorla birleştirme yapılmaz). Bu, kanıt satırları, dedup,
// outcome metrikleri ve trendin AYNI etiketler üzerinden çalışmasını sağlar.
export function canonicalizeCandidateThemes(
  candidates: TaskCandidate[],
  ownAggregated: AggregatedTheme[],
  competitorAggregated: AggregatedTheme[],
): TaskCandidate[] {
  const canonicalByNormalized = new Map<string, string>();
  for (const t of [...ownAggregated, ...competitorAggregated]) {
    const key = normalizeTheme(t.theme);
    if (!canonicalByNormalized.has(key)) {
      canonicalByNormalized.set(key, t.theme);
    }
  }
  const knownLabels = Array.from(canonicalByNormalized.values());

  return candidates.map((candidate) => {
    const exact = canonicalByNormalized.get(normalizeTheme(candidate.theme));
    if (exact) {
      return exact === candidate.theme ? candidate : { ...candidate, theme: exact };
    }
    const similar = findSimilarTheme(candidate.theme, knownLabels);
    return similar && similar !== candidate.theme ? { ...candidate, theme: similar } : candidate;
  });
}

// bkz. docs/02-business-rules.md Bölüm D — eşik/filtreleme mantığı promptta
// değil burada uygulanıyor.
export function filterCandidates(
  candidates: TaskCandidate[],
  ownAggregated: AggregatedTheme[],
  competitorAggregated: AggregatedTheme[],
  hasCompetitorData: boolean,
): TaskCandidate[] {
  const ownByTheme = new Map(ownAggregated.map((t) => [normalizeTheme(t.theme), t]));
  const competitorByTheme = new Map(competitorAggregated.map((t) => [normalizeTheme(t.theme), t]));

  return candidates.filter((candidate) => {
    const key = normalizeTheme(candidate.theme);

    if (candidate.source_type === "absolute_quality") {
      const own = ownByTheme.get(key);
      if (!own) {
        return false;
      }
      const total = own.positive_mentions + own.negative_mentions;
      if (total === 0 || own.negative_mentions === 0) {
        return false;
      }
      // bkz. docs/02-business-rules.md Bölüm D — sağlık/güvenlik zararı, ciddi
      // etik/yasal risk ya da dolandırıcılık iddiası içeren bir tema
      // 'critical' işaretlenmişse, tek bir olumsuz yorum bile mention-sayı
      // eşiğini atlayıp görev üretebilir (ciddiyet, sıklıktan bağımsızdır).
      if (own.severity === "critical") {
        return true;
      }
      if (own.negative_mentions < TASK_MENTION_THRESHOLD) {
        return false;
      }
      return own.negative_mentions / total > ABSOLUTE_QUALITY_NEGATIVE_RATIO_THRESHOLD;
    }

    if (!hasCompetitorData) {
      return false;
    }
    const competitor = competitorByTheme.get(key);
    return (competitor?.positive_mentions ?? 0) >= TASK_MENTION_THRESHOLD;
  });
}

export interface ScoredTaskCandidate extends TaskCandidate {
  impact_score: number;
  impact_score_breakdown: ImpactScoreBreakdown;
}

// bkz. docs/10-roadmap.md Faz 1.2 madde 2 — impact_score artık Aşama 2
// modelinden gelmiyor; her adayın teması için own/competitor mention
// kırılımı ve trend'i kullanılarak kod tarafında (@/lib/task-engine/impact-score)
// hesaplanır.
export function attachImpactScores(
  candidates: TaskCandidate[],
  ownAggregated: AggregatedTheme[],
  competitorAggregated: AggregatedTheme[],
  ownThemeTrends: ThemeTrendInput[],
): ScoredTaskCandidate[] {
  const ownByTheme = new Map(ownAggregated.map((t) => [normalizeTheme(t.theme), t]));
  const competitorByTheme = new Map(competitorAggregated.map((t) => [normalizeTheme(t.theme), t]));
  const ownTrendByTheme = new Map<string, ThemeTrend>(
    ownThemeTrends.map((t) => [normalizeTheme(t.theme), t.trend]),
  );

  return candidates.map((candidate) => {
    const key = normalizeTheme(candidate.theme);
    const ownTheme = ownByTheme.get(key);
    const ownTrend = ownTrendByTheme.get(key) ?? null;

    const { score, breakdown } =
      candidate.source_type === "absolute_quality"
        ? computeAbsoluteQualityImpactScore(
            ownTheme ?? { positive_mentions: 0, negative_mentions: 0 },
            ownTrend,
            ownTheme?.severity ?? "normal",
          )
        : computeCompetitiveGapImpactScore(
            competitorByTheme.get(key) ?? { positive_mentions: 0, negative_mentions: 0 },
            ownTheme,
            ownTrend,
          );

    return { ...candidate, impact_score: score, impact_score_breakdown: breakdown };
  });
}

// Kota (MAX_NEW_TASKS_PER_CYCLE) burada DEĞİL, upsertTasks'ta ve sadece yeni
// oluşturmalara uygulanır — bkz. docs/02-business-rules.md Bölüm D: mevcut açık
// görevlerin güncellenmesi kotadan düşmez, yoksa çözülmemiş temalar her döngüde
// kotayı tüketip yeni görevlerin yüzeye çıkmasını engelliyordu.
export function rankCandidates(candidates: ScoredTaskCandidate[]): ScoredTaskCandidate[] {
  return candidates
    .slice()
    .sort((a, b) => b.impact_score / b.effort_score - a.impact_score / a.effort_score);
}
