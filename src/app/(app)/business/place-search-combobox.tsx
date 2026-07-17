"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2Icon, MapPinIcon, StarIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Combobox'ın seçim çıktısı — API'nin PlaceSearchCandidate'ıyla aynı şekil
// (client bundle'a server lib import etmemek için burada ayrıca tanımlı).
export interface SelectedPlace {
  google_place_id: string;
  name: string;
  address: string | null;
  rating: number | null;
  review_count: number | null;
}

const MIN_QUERY_LENGTH = 3;
const DEBOUNCE_MS = 350;

async function fetchCandidates(query: string, lang: string): Promise<SelectedPlace[]> {
  const params = new URLSearchParams({ q: query, lang });
  const res = await fetch(`/api/places/search?${params.toString()}`);
  if (!res.ok) {
    throw new Error("places_search_failed");
  }
  const body = (await res.json()) as { candidates: SelectedPlace[] };
  return body.candidates;
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);
  return debounced;
}

// Google Places (New) Text Search üstünde debounce'lu "yazdıkça ara" combobox.
// Seçim yapılınca input yerine seçili işletme kartı gösterilir; "Değiştir" ile
// aramaya geri dönülür. Dropdown, base-ui Popover yerine bilinçli olarak basit
// absolute-positioned bir liste — form içinde focus/blur dansı kurmak Popover
// portal'ıyla gereksiz karmaşık (bkz. bu dizindeki diğer colocated bileşenler).
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
  const locale = useLocale();
  const listboxId = useId();

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const debouncedQuery = useDebouncedValue(query.trim(), DEBOUNCE_MS);
  const isQueryLongEnough = debouncedQuery.length >= MIN_QUERY_LENGTH;

  const { data: candidates, isFetching, isError } = useQuery({
    queryKey: ["places-search", debouncedQuery, locale],
    queryFn: () => fetchCandidates(debouncedQuery, locale),
    enabled: !selected && isQueryLongEnough,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Yeni sonuç listesi geldiğinde klavye imlecini sıfırla. Effect yerine
  // render sırasında ayarlıyoruz (cascading render'dan kaçınmak için).
  const [prevCandidates, setPrevCandidates] = useState(candidates);
  if (candidates !== prevCandidates) {
    setPrevCandidates(candidates);
    setActiveIndex(-1);
  }

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
      <div className="flex items-start justify-between gap-3 rounded-lg border bg-muted/30 p-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-medium">{selected.name}</span>
          {selected.address && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPinIcon className="size-3 shrink-0" />
              <span className="truncate">{selected.address}</span>
            </span>
          )}
          {selected.rating !== null && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <StarIcon className="size-3 shrink-0 fill-amber-400 text-amber-400" />
              {selected.rating}
              {selected.review_count !== null &&
                ` · ${t("placeReviews", { count: selected.review_count })}`}
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            onSelect(null);
          }}
        >
          {t("placeChange")}
        </Button>
      </div>
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
        {isFetching && (
          <Loader2Icon className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {query.trim().length > 0 && query.trim().length < MIN_QUERY_LENGTH && (
        <p className="mt-1 text-xs text-muted-foreground">{t("placeSearchHint")}</p>
      )}

      {showDropdown && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-72 w-full overflow-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
          onMouseDown={(e) => {
            // Input blur olup dropdown kapanmadan click'in işlenebilmesi için.
            e.preventDefault();
          }}
        >
          {isError && (
            <li className="px-3 py-2 text-sm text-destructive">{t("placeSearchError")}</li>
          )}
          {!isError && !isFetching && isQueryLongEnough && candidates?.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              {t("placeSearchNoResults")}
            </li>
          )}
          {!isError && isFetching && !candidates && (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              {t("placeSearchSearching")}
            </li>
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
                  selectCandidate(candidate);
                }}
              >
                <span className="text-sm font-medium">{candidate.name}</span>
                {candidate.address && (
                  <span className="text-xs text-muted-foreground">{candidate.address}</span>
                )}
                {candidate.rating !== null && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <StarIcon className="size-3 fill-amber-400 text-amber-400" />
                    {candidate.rating}
                    {candidate.review_count !== null &&
                      ` · ${t("placeReviews", { count: candidate.review_count })}`}
                  </span>
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
