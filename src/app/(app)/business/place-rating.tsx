"use client";

import { StarIcon } from "lucide-react";
import { useTranslations } from "next-intl";

// Kartta ve dropdown option'larında ortak yıldız + yorum sayısı satırı.
export function PlaceRating({
  rating,
  reviewCount,
}: {
  rating: number;
  reviewCount: number | null;
}) {
  const t = useTranslations("business.form");

  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <StarIcon className="size-3 shrink-0 fill-amber-400 text-amber-400" />
      {rating}
      {reviewCount !== null && ` · ${t("placeSearchReviews", { count: reviewCount })}`}
    </span>
  );
}
