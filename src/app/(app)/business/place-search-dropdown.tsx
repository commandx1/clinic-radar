"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { PlaceRating } from "./place-rating";
import type { PlaceSearch, SelectedPlace } from "./use-place-search";

// Arama sonuçlarının listelendiği listbox. Base-ui Popover yerine bilinçli
// olarak basit absolute-positioned bir liste (bkz. place-search-combobox).
export function PlaceSearchDropdown({
  listboxId,
  search,
  onPick,
}: {
  listboxId: string;
  search: PlaceSearch;
  onPick: (place: SelectedPlace) => void;
}) {
  const t = useTranslations("business.form");
  const { candidates, isFetching, isError, isQueryLongEnough, activeIndex } = search;

  return (
    <ul
      id={listboxId}
      role="listbox"
      className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
      onMouseDown={(e) => {
        // Input blur olup dropdown kapanmadan click'in işlenebilmesi için.
        e.preventDefault();
      }}
    >
      {isError && <li className="px-3 py-2 text-sm text-destructive">{t("placeSearchError")}</li>}
      {!isError && !isFetching && isQueryLongEnough && candidates?.length === 0 && (
        <li className="px-3 py-2 text-sm text-muted-foreground">{t("placeSearchNoResults")}</li>
      )}
      {!isError && isFetching && !candidates && (
        <li className="px-3 py-2 text-sm text-muted-foreground">{t("placeSearchSearching")}</li>
      )}
      {candidates?.map((candidate, index) => (
        <li key={candidate.google_place_id} role="option" aria-selected={index === activeIndex}>
          <Button
            type="button"
            variant="ghost"
            className={cn(
              "flex h-auto w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left",
              index === activeIndex && "bg-accent text-accent-foreground",
            )}
            onClick={() => {
              onPick(candidate);
            }}
          >
            <span className="text-sm font-medium">{candidate.name}</span>
            {candidate.address && (
              <span className="text-xs text-muted-foreground">{candidate.address}</span>
            )}
            {candidate.rating !== null && (
              <PlaceRating rating={candidate.rating} reviewCount={candidate.review_count} />
            )}
          </Button>
        </li>
      ))}
    </ul>
  );
}
