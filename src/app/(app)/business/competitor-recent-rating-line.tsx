"use client";

import { useTranslations } from "next-intl";

// bkz. docs/08-dashboard.md Competitors, src/lib/analysis/recent-ratings.ts —
// "canlı puan" (analiz penceresindeki taze yorumlardan hesaplanan ortalama),
// resmi puanın (competitor.rating) hemen altında ayrı bir satır olarak
// gösterilir. `recentRating` null ise (henüz RECENT_RATING_MIN_REVIEWS'e
// ulaşmadıysa) hiçbir şey render edilmez — uydurma/eksik veri gösterilmez.
export function CompetitorRecentRatingLine({
  recentRating,
  recentRatingReviews,
  recentRatingWindowDays,
}: {
  recentRating: number | null;
  recentRatingReviews: number | null;
  recentRatingWindowDays: number | null;
}) {
  const t = useTranslations("business.competitors.list");

  if (recentRating === null || recentRatingWindowDays === null) {
    return null;
  }

  return (
    <p className="text-xs text-muted-foreground">
      {t("recentRating", {
        window: recentRatingWindowDays,
        rating: recentRating.toFixed(1),
        count: recentRatingReviews ?? 0,
      })}
    </p>
  );
}
