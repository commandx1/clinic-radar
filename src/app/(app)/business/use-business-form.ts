"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import type { CreateBusinessInput } from "@/lib/validations/business";

import { isKnownCategory } from "./category-select";
import type { SelectedPlace } from "./place-search-combobox";

async function createBusiness(input: CreateBusinessInput): Promise<void> {
  const res = await fetch("/api/business", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "insert_failed");
  }
}

export function useBusinessForm() {
  const t = useTranslations("business.form");
  const tErrors = useTranslations("business.errors");
  const router = useRouter();

  const [name, setName] = useState("");
  // Place ID artık elle girilmiyor — Google Places combobox'ından seçiliyor
  // (bkz. place-search-combobox.tsx). Kalıcı saklanan tek alan google_place_id.
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);
  const [placeError, setPlaceError] = useState(false);
  const [category, setCategory] = useState("");
  const [currentTool, setCurrentTool] = useState("");

  const mutation = useMutation({
    mutationFn: createBusiness,
    onSuccess: () => {
      toast.success(t("success"));
      router.refresh();
    },
  });

  // Seçimde işletme adını otomatik doldur (kullanıcı yazdıysa dokunma) —
  // "Değiştir" sonrası yeni seçimde de aynı kural geçerli.
  function handlePlaceSelect(place: SelectedPlace | null) {
    setSelectedPlace(place);
    setPlaceError(false);
    if (place && name.trim().length === 0) {
      setName(place.name);
    }
    // İsimle aynı kural: kullanıcı elle seçtiyse üzerine yazma.
    if (place?.category && category === "" && isKnownCategory(place.category)) {
      setCategory(place.category);
    }
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedPlace) {
      setPlaceError(true);
      return;
    }
    mutation.mutate({
      name,
      google_place_id: selectedPlace.google_place_id,
      category: category || undefined,
      current_tool: currentTool,
    });
  }

  let errorMessage: string | null = null;
  if (placeError) {
    errorMessage = t("placeRequired");
  } else if (mutation.error) {
    errorMessage = tErrors.has(mutation.error.message)
      ? tErrors(mutation.error.message)
      : t("genericError");
    toast.error(errorMessage);
  }

  return {
    name,
    setName,
    selectedPlace,
    handlePlaceSelect,
    category,
    setCategory,
    currentTool,
    setCurrentTool,
    errorMessage,
    isPending: mutation.isPending,
    handleSubmit,
  };
}
