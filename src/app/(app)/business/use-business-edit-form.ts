"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import type { UpdateBusinessInput } from "@/lib/validations/business";

import { isKnownCategory } from "./category-select";
import type { SelectedPlace } from "./place-search-combobox";

export interface EditableBusiness {
  id: string;
  name: string;
  google_place_id: string | null;
  category: string | null;
}

async function updateBusiness(id: string, input: UpdateBusinessInput): Promise<void> {
  const res = await fetch(`/api/business/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "update_failed");
  }
}

// Mevcut place'i combobox'ın "seçili" kartı olarak temsil et. Adres/rating
// DB'de yok (sadece place_id saklıyoruz) — kartta yalnızca isim görünür,
// kullanıcı "Değiştir" deyince aramayla yenisini seçer.
function toInitialSelectedPlace(business: EditableBusiness): SelectedPlace | null {
  if (!business.google_place_id) {
    return null;
  }
  return {
    google_place_id: business.google_place_id,
    name: business.name,
    address: null,
    rating: null,
    review_count: null,
    category: null,
  };
}

// bkz. use-business-form.ts (create) — aynı colocated-hook deseni, PATCH sürümü.
// google_place_id değiştiğinde route re-enrichment tetikler (lat/lng/rating),
// bu yüzden başarıda router.refresh() ile SSR yeniden çalışır: enrichment artık
// başarılıysa layout "enrichmentFailed" ekranından ilerler.
export function useBusinessEditForm(business: EditableBusiness, onDone?: () => void) {
  const t = useTranslations("business.edit");
  const tForm = useTranslations("business.form");
  const tErrors = useTranslations("business.errors");
  const router = useRouter();

  const [name, setName] = useState(business.name);
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(
    toInitialSelectedPlace(business),
  );
  const [placeError, setPlaceError] = useState(false);
  const [category, setCategory] = useState(business.category ?? "");

  const mutation = useMutation({
    mutationFn: (input: UpdateBusinessInput) => updateBusiness(business.id, input),
    onSuccess: () => {
      toast.success(t("success"));
      onDone?.();
      router.refresh();
    },
  });

  function handlePlaceSelect(place: SelectedPlace | null) {
    setSelectedPlace(place);
    setPlaceError(false);
    // Edit akışında bilinçli olarak koşulsuz: yeni place seçmek işletme
    // kimliğini değiştirmektir, kategori de yeni place'in türüne güncellenir
    // (kullanıcı dropdown'dan sonradan yine değiştirebilir).
    if (place?.category && isKnownCategory(place.category)) {
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
    });
  }

  let errorMessage: string | null = null;
  if (placeError) {
    errorMessage = tForm("placeRequired");
  } else if (mutation.error) {
    errorMessage = tErrors.has(mutation.error.message) ? tErrors(mutation.error.message) : t("genericError");
    toast.error(errorMessage);
  }

  return {
    name,
    setName,
    selectedPlace,
    handlePlaceSelect,
    category,
    setCategory,
    errorMessage,
    isPending: mutation.isPending,
    handleSubmit,
  };
}
