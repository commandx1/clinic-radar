// bkz. docs/09-task-engine.md "Opportunity Estimate" — Overview'daki "Fırsat
// tahmini" kartının saf hesaplama katmanı. Sonuç HER ZAMAN bantlıdır (min/max
// aralığı ya da null), asla tek bir kesin sayı olarak sunulmaz — CLAUDE.md ve
// docs/10-roadmap.md'nin "asla '+0.18 yıldız' gibi kesin tahmin verilmez"
// kuralı bu modül için de geçerli. DB/Supabase'e hiç dokunmaz; okuma tarafı
// src/app/(app)/business/resolve-opportunity-estimate.ts'tedir.
import {
  OPPORTUNITY_RATING_FILTER_THRESHOLD,
  OPPORTUNITY_REVENUE_PCT_PER_STAR_MAX,
  OPPORTUNITY_REVENUE_PCT_PER_STAR_MIN,
  OPPORTUNITY_REVIEW_VELOCITY_GAP_RATIO,
} from "@/lib/constants";

const DAYS_PER_MONTH = 30;
const MONTHS_PER_YEAR = 12;
// $ bandı 2 anlamlı basamağa yuvarlanır (12.345 değil 12.000) — bant, kesinlik
// değil.
const DOLLAR_SIGNIFICANT_FIGURES = 2;

export interface OpportunityInput {
  ownRating: number | null;
  competitorRatings: (number | null)[];
  ownReviewsInWindow: number;
  competitorReviewsInWindow: number[];
  windowDays: number;
  avgPatientValueUsd: number | null;
  monthlyNewPatients: number | null;
}

export interface OpportunityEstimate {
  // Rakip MEDYAN puanı − own puan, 1 ondalığa yuvarlanır. own puan yoksa ya
  // da hiç rakip puanı yoksa null. Negatif olabilir (kullanıcı önde).
  ratingGap: number | null;
  competitorMedianRating: number | null;
  // gap > 0 ise [gap*MIN, gap*MAX] (1dp yuvarlı), aksi halde null — kullanıcı
  // zaten rakip medyanının önündeyse/eşitse "kapatılacak fark" yok.
  revenueUpliftPctRange: [number, number] | null;
  // Yalnızca iş girdileri (avgPatientValueUsd, monthlyNewPatients) dolu VE
  // gap > 0 ise dolar.
  annualRevenueUsdRange: [number, number] | null;
  // own < 4.0 VE rakip medyanı >= 4.0 ise true — hastaların büyük kısmının
  // 4.0 altını elemeden geçirmediği kabul edilen eşik.
  belowFilterThreshold: boolean;
  ownReviewsPerMonth: number;
  competitorAvgReviewsPerMonth: number;
  // own / rakip ortalaması; rakip ortalaması 0 ise null (bölme tanımsız).
  reviewVelocityRatio: number | null;
  velocityGap: boolean;
}

function round1dp(value: number): number {
  return Math.round(value * 10) / 10;
}

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
}

function toPerMonth(count: number, windowDays: number): number {
  return windowDays > 0 ? count / (windowDays / DAYS_PER_MONTH) : 0;
}

function roundToSignificantFigures(value: number, sigFigs: number): number {
  if (value === 0) {
    return 0;
  }
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  const magnitude = Math.floor(Math.log10(abs));
  const factor = 10 ** (magnitude - sigFigs + 1);
  return sign * Math.round(abs / factor) * factor;
}

export function estimateOpportunity(input: OpportunityInput): OpportunityEstimate {
  const competitorRatings = input.competitorRatings.filter((r): r is number => r !== null);
  const competitorMedianRatingRaw = median(competitorRatings);
  const competitorMedianRating = competitorMedianRatingRaw !== null ? round1dp(competitorMedianRatingRaw) : null;

  const ratingGap =
    input.ownRating !== null && competitorMedianRating !== null
      ? round1dp(competitorMedianRating - input.ownRating)
      : null;

  const revenueUpliftPctRange: [number, number] | null =
    ratingGap !== null && ratingGap > 0
      ? [
          round1dp(ratingGap * OPPORTUNITY_REVENUE_PCT_PER_STAR_MIN),
          round1dp(ratingGap * OPPORTUNITY_REVENUE_PCT_PER_STAR_MAX),
        ]
      : null;

  const annualRevenueUsdRange: [number, number] | null =
    revenueUpliftPctRange !== null && input.avgPatientValueUsd !== null && input.monthlyNewPatients !== null
      ? [
          roundToSignificantFigures(
            input.monthlyNewPatients * MONTHS_PER_YEAR * input.avgPatientValueUsd * (revenueUpliftPctRange[0] / 100),
            DOLLAR_SIGNIFICANT_FIGURES,
          ),
          roundToSignificantFigures(
            input.monthlyNewPatients * MONTHS_PER_YEAR * input.avgPatientValueUsd * (revenueUpliftPctRange[1] / 100),
            DOLLAR_SIGNIFICANT_FIGURES,
          ),
        ]
      : null;

  const belowFilterThreshold =
    input.ownRating !== null &&
    competitorMedianRating !== null &&
    input.ownRating < OPPORTUNITY_RATING_FILTER_THRESHOLD &&
    competitorMedianRating >= OPPORTUNITY_RATING_FILTER_THRESHOLD;

  const ownReviewsPerMonth = toPerMonth(input.ownReviewsInWindow, input.windowDays);
  const competitorAvgReviewsPerMonth = toPerMonth(average(input.competitorReviewsInWindow), input.windowDays);
  const reviewVelocityRatio =
    competitorAvgReviewsPerMonth > 0 ? ownReviewsPerMonth / competitorAvgReviewsPerMonth : null;
  const velocityGap = reviewVelocityRatio !== null && reviewVelocityRatio < OPPORTUNITY_REVIEW_VELOCITY_GAP_RATIO;

  return {
    ratingGap,
    competitorMedianRating,
    revenueUpliftPctRange,
    annualRevenueUsdRange,
    belowFilterThreshold,
    ownReviewsPerMonth,
    competitorAvgReviewsPerMonth,
    reviewVelocityRatio,
    velocityGap,
  };
}
