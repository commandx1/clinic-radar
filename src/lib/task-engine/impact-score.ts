// bkz. docs/10-roadmap.md Faz 1.2 "Impact score'un kod tarafında bileşenlerden
// hesaplanması" ve docs/09-task-engine.md "Impact score bileşenleri (v1)".
// Skor artık Aşama 2 modelinden ALINMAZ — rakip yaygınlığı + trend + own
// eksikliği kırılımından kod tarafında hesaplanır. Görev kartında "neden bu
// skor" kırılımını göstermek için ham bileşenler de döndürülür.
import {
  IMPACT_SCORE_ABSOLUTE_QUALITY_DEFICIENCY_WEIGHT,
  IMPACT_SCORE_ABSOLUTE_QUALITY_VOLUME_WEIGHT,
  IMPACT_SCORE_COMPETITOR_PREVALENCE_WEIGHT,
  IMPACT_SCORE_MENTION_VOLUME_SCALE,
  IMPACT_SCORE_OWN_DEFICIENCY_WEIGHT,
  IMPACT_SCORE_TREND_IMPROVING_PENALTY,
  IMPACT_SCORE_TREND_WORSENING_BONUS,
} from "@/lib/constants";

export type ThemeTrend = "improving" | "worsening" | "stable" | null;

export interface ThemeMentionCounts {
  positive_mentions: number;
  negative_mentions: number;
}

export interface ImpactScoreBreakdown {
  // 0-100 — rakibin bu temada ne kadar güçlü/yaygın olduğu (competitive_gap)
  // ya da mention hacminin ne kadar geniş olduğu (absolute_quality). Rakip
  // verisi yoksa (absolute_quality) null.
  competitor_prevalence: number | null;
  // 0-100 — kliniğin bu temadaki eksikliği/zayıflığı (own negatif oranı ya
  // da bu temada hiç own verisi yoksa tam eksiklik).
  own_deficiency: number;
  // Own tema trend'i (bkz. theme_summary.trend) — bulunamazsa null.
  trend: ThemeTrend;
  // trend'den gelen ek puan (worsening +, improving -, stable/null 0).
  trend_adjustment: number;
}

export interface ImpactScoreResult {
  score: number;
  breakdown: ImpactScoreBreakdown;
}

function ratio(part: number, total: number): number {
  return total > 0 ? part / total : 0;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function trendAdjustment(trend: ThemeTrend): number {
  if (trend === "worsening") {
    return IMPACT_SCORE_TREND_WORSENING_BONUS;
  }
  if (trend === "improving") {
    return IMPACT_SCORE_TREND_IMPROVING_PENALTY;
  }
  return 0;
}

function volumeComponent(mentionCount: number): number {
  return clampScore((mentionCount / IMPACT_SCORE_MENTION_VOLUME_SCALE) * 100);
}

// competitive_gap: rakip(ler) bu temada güçlü (pozitif ağırlıklı), klinik bu
// temada zayıf/eksik. `competitorTheme` filterCandidates aşamasında zaten
// zorunlu kılınmıştır (temaya dair rakip verisi olmadan aday elenir).
export function computeCompetitiveGapImpactScore(
  competitorTheme: ThemeMentionCounts,
  ownTheme: ThemeMentionCounts | undefined,
  ownTrend: ThemeTrend,
): ImpactScoreResult {
  const competitorTotal = competitorTheme.positive_mentions + competitorTheme.negative_mentions;
  const competitorPrevalence = clampScore(ratio(competitorTheme.positive_mentions, competitorTotal) * 100);

  // own bu temada hiç veri üretmediyse (model bahsetmedi) tam eksiklik kabul
  // edilir — rakip güçlü, klinik bu konuda sessiz.
  const ownTotal = ownTheme ? ownTheme.positive_mentions + ownTheme.negative_mentions : 0;
  const ownPositiveRatio = ownTheme ? ratio(ownTheme.positive_mentions, ownTotal) : 0;
  const ownDeficiency = clampScore((1 - ownPositiveRatio) * 100);

  const adjustment = trendAdjustment(ownTrend);
  const score = clampScore(
    competitorPrevalence * IMPACT_SCORE_COMPETITOR_PREVALENCE_WEIGHT +
      ownDeficiency * IMPACT_SCORE_OWN_DEFICIENCY_WEIGHT +
      adjustment,
  );

  return {
    score,
    breakdown: {
      competitor_prevalence: competitorPrevalence,
      own_deficiency: ownDeficiency,
      trend: ownTrend,
      trend_adjustment: adjustment,
    },
  };
}

// absolute_quality: rakip fark etmeksizin kliniğin kendi ciddi/tekrar eden
// sorunu. Rakip yaygınlığı burada anlamsız — yerine mention hacmi (sorunun ne
// kadar "geniş" konuşulduğu) kullanılır.
export function computeAbsoluteQualityImpactScore(
  ownTheme: ThemeMentionCounts,
  ownTrend: ThemeTrend,
): ImpactScoreResult {
  const ownTotal = ownTheme.positive_mentions + ownTheme.negative_mentions;
  const ownDeficiency = clampScore(ratio(ownTheme.negative_mentions, ownTotal) * 100);
  const volume = volumeComponent(ownTheme.negative_mentions);

  const adjustment = trendAdjustment(ownTrend);
  const score = clampScore(
    ownDeficiency * IMPACT_SCORE_ABSOLUTE_QUALITY_DEFICIENCY_WEIGHT +
      volume * IMPACT_SCORE_ABSOLUTE_QUALITY_VOLUME_WEIGHT +
      adjustment,
  );

  return {
    score,
    breakdown: {
      competitor_prevalence: null,
      own_deficiency: ownDeficiency,
      trend: ownTrend,
      trend_adjustment: adjustment,
    },
  };
}
