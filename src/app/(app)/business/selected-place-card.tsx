"use client";

import { MapPinIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

import { PlaceRating } from "./place-rating";
import type { SelectedPlace } from "./use-place-search";

// Seçim yapıldıktan sonra input yerine gösterilen işletme kartı.
export function SelectedPlaceCard({
  place,
  onChange,
}: {
  place: SelectedPlace;
  onChange: () => void;
}) {
  const t = useTranslations("business.form");

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/30 p-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium">{place.name}</span>
        {place.address && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPinIcon className="size-3 shrink-0" />
            <span className="truncate">{place.address}</span>
          </span>
        )}
        {place.rating !== null && (
          <PlaceRating rating={place.rating} reviewCount={place.review_count} />
        )}
      </div>
      <Button type="button" variant="ghost" size="sm" onClick={onChange}>
        {t("placeSearchChange")}
      </Button>
    </div>
  );
}
