"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import type { CreateBusinessInput } from "@/lib/validations/business";

import { BUSINESS_SAVE_STEP_KEYS, triggerBusinessEnrichment, type BusinessSaveStepKey } from "./business-save-steps";
import { isKnownCategory } from "./category-select";
import type { SelectedPlace } from "./place-search-combobox";

async function createBusiness(input: CreateBusinessInput): Promise<{ id: string }> {
  const res = await fetch("/api/business", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "insert_failed");
  }

  const body = (await res.json()) as { business: { id: string } };
  return { id: body.business.id };
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
  const [step, setStep] = useState<BusinessSaveStepKey>(BUSINESS_SAVE_STEP_KEYS[0]);

  // İki gerçek network sınırı: önce işletme kaydedilir (hızlı), ardından
  // Apify zenginleştirmesi ayrı bir istekte tetiklenir (best-effort — bkz.
  // business-save-steps.ts). Zenginleştirme başarısız olsa da mutation
  // başarılı sayılır, çünkü işletme zaten kayıtlıdır.
  const mutation = useMutation({
    mutationFn: async (input: CreateBusinessInput) => {
      setStep("saving");
      const { id } = await createBusiness(input);
      setStep("enriching");
      await triggerBusinessEnrichment(id);
    },
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
    setStep(BUSINESS_SAVE_STEP_KEYS[0]);
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
    stepKey: step,
    stepIndex: BUSINESS_SAVE_STEP_KEYS.indexOf(step),
    stepCount: BUSINESS_SAVE_STEP_KEYS.length,
    handleSubmit,
  };
}
