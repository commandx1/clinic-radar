"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { useEffect, useState } from "react";

// Combobox'ın seçim çıktısı — API'nin PlaceSearchCandidate'ıyla aynı şekil
// (client bundle'a server lib import etmemek için burada ayrıca tanımlı).
export interface SelectedPlace {
  google_place_id: string;
  name: string;
  address: string | null;
  rating: number | null;
  review_count: number | null;
  category: string | null;
}

export const MIN_QUERY_LENGTH = 3;
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

// Debounce'lu Places araması + dropdown açık/kapalı ve klavye imleç state'i.
export function usePlaceSearch(enabled: boolean) {
  const locale = useLocale();

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const debouncedQuery = useDebouncedValue(query.trim(), DEBOUNCE_MS);
  const isQueryLongEnough = debouncedQuery.length >= MIN_QUERY_LENGTH;

  const { data: candidates, isFetching, isError } = useQuery({
    queryKey: ["places-search", debouncedQuery, locale],
    queryFn: () => fetchCandidates(debouncedQuery, locale),
    enabled: enabled && isQueryLongEnough,
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

  return {
    query,
    setQuery,
    isOpen,
    setIsOpen,
    activeIndex,
    setActiveIndex,
    candidates,
    isFetching,
    isError,
    isQueryLongEnough,
  };
}

export type PlaceSearch = ReturnType<typeof usePlaceSearch>;
