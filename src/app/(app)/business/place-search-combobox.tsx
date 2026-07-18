"use client";

import { Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId } from "react";

import { Input } from "@/components/ui/input";

import { PlaceSearchDropdown } from "./place-search-dropdown";
import { SelectedPlaceCard } from "./selected-place-card";
import { MIN_QUERY_LENGTH, usePlaceSearch, type SelectedPlace } from "./use-place-search";

export type { SelectedPlace } from "./use-place-search";

// Google Places (New) Text Search üstünde debounce'lu "yazdıkça ara" combobox.
// Seçim yapılınca input yerine seçili işletme kartı gösterilir; "Değiştir" ile
// aramaya geri dönülür. Veri/state use-place-search'te, kart ve listbox kendi
// colocated dosyalarında — burası sadece orkestrasyon.
export function PlaceSearchCombobox({
  inputId,
  selected,
  onSelect,
}: {
  inputId: string;
  selected: SelectedPlace | null;
  onSelect: (place: SelectedPlace | null) => void;
}) {
  const t = useTranslations("business.form");
  const listboxId = useId();

  const search = usePlaceSearch(!selected);
  const { query, setQuery, isOpen, setIsOpen, activeIndex, setActiveIndex, candidates } = search;

  function selectCandidate(candidate: SelectedPlace) {
    onSelect(candidate);
    setQuery("");
    setIsOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || !candidates || candidates.length === 0) {
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % candidates.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? candidates.length - 1 : prev - 1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < candidates.length) {
        e.preventDefault();
        selectCandidate(candidates[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  if (selected) {
    return (
      <SelectedPlaceCard
        place={selected}
        onChange={() => {
          onSelect(null);
        }}
      />
    );
  }

  const showDropdown = isOpen && query.trim().length >= MIN_QUERY_LENGTH;

  return (
    <div className="relative">
      <div className="relative">
        <Input
          id={inputId}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          autoComplete="off"
          placeholder={t("placeSearchPlaceholder")}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
          }}
          onBlur={() => {
            // Option'lardaki onMouseDown preventDefault ile focus'u koruyor;
            // buraya düşen blur gerçekten dışarı tıklamadır.
            setIsOpen(false);
          }}
          onKeyDown={handleKeyDown}
        />
        {search.isFetching && (
          <Loader2Icon className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {query.trim().length > 0 && query.trim().length < MIN_QUERY_LENGTH && (
        <p className="mt-1 text-xs text-muted-foreground">{t("placeSearchHint")}</p>
      )}

      {showDropdown && (
        <PlaceSearchDropdown listboxId={listboxId} search={search} onPick={selectCandidate} />
      )}
    </div>
  );
}
