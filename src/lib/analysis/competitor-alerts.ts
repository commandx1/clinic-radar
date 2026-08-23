// bkz. docs/02-business-rules.md Bölüm G kural 4/5/6, docs/09-task-engine.md,
// src/lib/analysis/recent-ratings.ts. Saf/test edilebilir çekirdek — hiçbir
// DB/AI çağrısı yapmaz (bkz. competitor-alerts.test.ts); çağıran taraf
// (execute-analysis.ts runAnalysisPipeline) girdiyi recent-ratings.ts ve
// analysis-delta.ts'in ürettiği verilerden derler, sonra her alert'i
// recordNotification ile kaydeder ve AnalysisDelta.alerts'e ekler.
import {
  COMPETITOR_NEGATIVE_SPIKE_MULTIPLIER,
  COMPETITOR_RATING_SHIFT_THRESHOLD,
  COMPETITOR_REVIEW_SURGE_MIN_REVIEWS,
  COMPETITOR_REVIEW_SURGE_MULTIPLIER,
  THEME_TREND_MIN_MENTIONS,
} from "@/lib/constants";

// Bir rakip için en fazla kaç "negatif tema patlaması" uyarısı üretilir —
// gürültü kontrolü, tek bir rakibin uyarı listesini boğmasın diye.
const MAX_NEGATIVE_SPIKES_PER_COMPETITOR = 3;

export type CompetitorAlertType =
  | "competitor_review_surge"
  | "competitor_rating_shift"
  | "competitor_negative_spike";

export type CompetitorAlertDetail = Record<string, number | string>;

export interface CompetitorAlert {
  type: CompetitorAlertType;
  competitor_id: string;
  competitor_name: string;
  // Bildirim payload'ına ve AnalysisDelta.alerts'e aynı şekilde geçer —
  // yalnızca sayısal/metin türetilmiş metrikler, ham yorum metni asla yok
  // (bkz. docs/02-business-rules.md Bölüm H).
  detail: CompetitorAlertDetail;
}

export interface CompetitorNegativeThemeSpikeInput {
  theme: string;
  previousNegative: number;
  currentNegative: number;
}

export interface CompetitorAlertCompetitorInput {
  id: string;
  name: string;
  newReviewsThisCycle: number;
  // (pencere içindeki toplam yorum sayısı / pencere gün sayısı) × 30 —
  // rakibin "olağan" aylık yorum hızı, bu döngüdeki patlamayı kıyaslamak için.
  avgMonthlyReviews: number;
  // Bir önceki analizden bu yana geçen gün sayısı (en az 1). null = ilk
  // analiz: "bu döngüdeki yeni yorumlar" pencerenin tamamı olur, kıyas
  // anlamsızdır — surge kuralı hiç değerlendirilmez. Döngü 7 gün de olabilir
  // 60 gün de; beklenen hacim bu süreye göre ölçeklenir, aksi halde uzun
  // aralıklı her analiz sahte "patlama" üretirdi.
  cycleDays: number | null;
  previousRecentRating: number | null;
  currentRecentRating: number | null;
  negativeThemeSpikes: CompetitorNegativeThemeSpikeInput[];
}

export interface DetectCompetitorAlertsInput {
  competitors: CompetitorAlertCompetitorInput[];
}

// bkz. docs/02-business-rules.md Bölüm G kural 4 — bir rakip bu döngüde en
// az COMPETITOR_REVIEW_SURGE_MIN_REVIEWS yeni yorum aldıysa VE bu sayı
// olağan aylık hızının en az COMPETITOR_REVIEW_SURGE_MULTIPLIER katıysa.
function detectReviewSurge(competitor: CompetitorAlertCompetitorInput): CompetitorAlert | null {
  if (competitor.cycleDays === null) {
    return null;
  }
  if (competitor.newReviewsThisCycle < COMPETITOR_REVIEW_SURGE_MIN_REVIEWS) {
    return null;
  }
  // Olağan aylık hız, bu döngünün uzunluğuna ölçeklenir: 7 günlük döngüde
  // aylık hızın ~1/4'ü beklenir, 60 günlük aralıkta 2 katı.
  const expectedThisCycle = competitor.avgMonthlyReviews * (Math.max(1, competitor.cycleDays) / 30);
  if (competitor.newReviewsThisCycle < COMPETITOR_REVIEW_SURGE_MULTIPLIER * expectedThisCycle) {
    return null;
  }
  return {
    type: "competitor_review_surge",
    competitor_id: competitor.id,
    competitor_name: competitor.name,
    detail: {
      new_reviews: competitor.newReviewsThisCycle,
      avg_monthly_reviews: Math.round(competitor.avgMonthlyReviews * 10) / 10,
      cycle_days: Math.max(1, Math.round(competitor.cycleDays)),
    },
  };
}

// bkz. docs/02-business-rules.md Bölüm G kural 5 — bir rakibin canlı puanı
// (recent_rating) bir önceki döngüye göre en az COMPETITOR_RATING_SHIFT_THRESHOLD
// (0-5 skalasında) değiştiyse; iki taraf da doluysa (biri null ise kıyas
// anlamsız, ör. ilk kez eşik geçildi).
function detectRatingShift(competitor: CompetitorAlertCompetitorInput): CompetitorAlert | null {
  if (competitor.previousRecentRating === null || competitor.currentRecentRating === null) {
    return null;
  }
  const delta = competitor.currentRecentRating - competitor.previousRecentRating;
  if (Math.abs(delta) < COMPETITOR_RATING_SHIFT_THRESHOLD) {
    return null;
  }
  return {
    type: "competitor_rating_shift",
    competitor_id: competitor.id,
    competitor_name: competitor.name,
    detail: {
      from: competitor.previousRecentRating,
      to: competitor.currentRecentRating,
      direction: delta > 0 ? "up" : "down",
    },
  };
}

// bkz. docs/02-business-rules.md Bölüm G kural 6 — bir rakibin belirli bir
// temadaki negatif mention'ı, THEME_TREND_MIN_MENTIONS gürültü eşiğini
// geçtiyse VE önceki döngüye göre en az COMPETITOR_NEGATIVE_SPIKE_MULTIPLIER
// katına çıktıysa (önceki mention'ın en az 1 olması şartıyla — 0'dan
// herhangi bir sayıya "sonsuz kat" artış gürültüdür, ayrı bir sinyal değil).
// Bir rakip için en fazla MAX_NEGATIVE_SPIKES_PER_COMPETITOR tane üretilir.
function detectNegativeSpikes(competitor: CompetitorAlertCompetitorInput): CompetitorAlert[] {
  const alerts: CompetitorAlert[] = [];
  for (const spike of competitor.negativeThemeSpikes) {
    if (alerts.length >= MAX_NEGATIVE_SPIKES_PER_COMPETITOR) {
      break;
    }
    if (spike.previousNegative < 1) {
      continue;
    }
    if (spike.currentNegative < THEME_TREND_MIN_MENTIONS) {
      continue;
    }
    if (spike.currentNegative < COMPETITOR_NEGATIVE_SPIKE_MULTIPLIER * spike.previousNegative) {
      continue;
    }
    alerts.push({
      type: "competitor_negative_spike",
      competitor_id: competitor.id,
      competitor_name: competitor.name,
      detail: {
        theme: spike.theme,
        previous_negative: spike.previousNegative,
        current_negative: spike.currentNegative,
      },
    });
  }
  return alerts;
}

export function detectCompetitorAlerts(input: DetectCompetitorAlertsInput): CompetitorAlert[] {
  const alerts: CompetitorAlert[] = [];
  for (const competitor of input.competitors) {
    const surge = detectReviewSurge(competitor);
    if (surge) {
      alerts.push(surge);
    }
    const ratingShift = detectRatingShift(competitor);
    if (ratingShift) {
      alerts.push(ratingShift);
    }
    alerts.push(...detectNegativeSpikes(competitor));
  }
  return alerts;
}
