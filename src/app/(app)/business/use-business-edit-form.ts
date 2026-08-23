"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import type { UpdateBusinessInput } from "@/lib/validations/business";

import { BUSINESS_SAVE_STEP_KEYS, triggerBusinessEnrichment, type BusinessSaveStepKey } from "./business-save-steps";
import { isKnownCategory } from "./category-select";
import type { SelectedPlace } from "./place-search-combobox";

export interface EditableBusiness {
  id: string;
  name: string;
  google_place_id: string | null;
  category: string | null;
  trustpilot_domain: string | null;
  avg_patient_value_usd: number | null;
  monthly_new_patients: number | null;
}

// Boş input -> null (temizle), sayısal olmayan/negatif -> null (hatalı girdi
// sessizce yok sayılır, input zaten type="number" min={0} ile kısıtlı).
function parseOptionalNonNegativeNumber(value: string): number | null {
  if (value.trim() === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

// monthly_new_patients DB'de integer — zod `.int()` ondalık gönderilirse
// 400 döner, bu yüzden client tarafında da tamsayıya yuvarlanır.
function parseOptionalNonNegativeInteger(value: string): number | null {
  const parsed = parseOptionalNonNegativeNumber(value);
  return parsed !== null ? Math.round(parsed) : null;
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
export function useBusinessEditForm(business: EditableBusiness, isPro: boolean, onDone?: () => void) {
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
  const [trustpilotDomain, setTrustpilotDomain] = useState(business.trustpilot_domain ?? "");
  const [avgPatientValueUsd, setAvgPatientValueUsd] = useState(
    business.avg_patient_value_usd !== null ? String(business.avg_patient_value_usd) : "",
  );
  const [monthlyNewPatients, setMonthlyNewPatients] = useState(
    business.monthly_new_patients !== null ? String(business.monthly_new_patients) : "",
  );
  const [step, setStep] = useState<BusinessSaveStepKey>(BUSINESS_SAVE_STEP_KEYS[0]);

  // use-business-form.ts (create) ile aynı desen: PATCH hızlı döner, place
  // değiştiyse zenginleştirme ayrı bir istekte (best-effort) tetiklenir —
  // bkz. business-save-steps.ts. Place değişmediyse "enriching" adımına hiç
  // geçilmez, çünkü zenginleştirilecek yeni bir konum/rating yok.
  const mutation = useMutation({
    mutationFn: async (input: UpdateBusinessInput) => {
      setStep("saving");
      await updateBusiness(business.id, input);
      if (input.google_place_id !== undefined && input.google_place_id !== business.google_place_id) {
        setStep("enriching");
        await triggerBusinessEnrichment(business.id);
      }
    },
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
    // kimliğini değiştirmektir — isim ve kategori yeni place'ten dolar
    // (kullanıcı ikisini de sonradan elle değiştirebilir). Aksi halde eski
    // işletmenin adı yeni place_id ile kaydediliyordu.
    if (place) {
      setName(place.name);
    }
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
    setStep(BUSINESS_SAVE_STEP_KEYS[0]);
    mutation.mutate({
      name,
      google_place_id: selectedPlace.google_place_id,
      category: category || undefined,
      // trustpilot_domain_override'ın aksine bunlar Pro'ya özel değil ve
      // null'a çekilmesi zararsız — bu yüzden koşulsuz her submit'te
      // gönderilir (diğer sıradan alanlarla aynı desen).
      avg_patient_value_usd: parseOptionalNonNegativeNumber(avgPatientValueUsd),
      monthly_new_patients: parseOptionalNonNegativeInteger(monthlyNewPatients),
      // Sadece Pro kullanıcı ve SADECE değer gerçekten değiştiyse gönderilir.
      // Değişmediğinde göndermek zararsız değil: route boş string'i "Trustpilot
      // profilim yok" olarak yorumlayıp `trustpilot_checked_at`'i doldurur. O
      // zaman Trustpilot alanına hiç dokunmadan sadece adını değiştiren bir
      // kullanıcı, henüz hiç aranmamış (checked_at = null) işletmesi için
      // otomatik aramayı kalıcı olarak kapatmış olurdu (bkz.
      // resolve-trustpilot-refs.ts cache kuralı).
      ...(isPro &&
        trustpilotDomain !== (business.trustpilot_domain ?? "") && {
          trustpilot_domain_override: trustpilotDomain,
        }),
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
    trustpilotDomain,
    setTrustpilotDomain,
    avgPatientValueUsd,
    setAvgPatientValueUsd,
    monthlyNewPatients,
    setMonthlyNewPatients,
    errorMessage,
    isPending: mutation.isPending,
    stepKey: step,
    stepIndex: BUSINESS_SAVE_STEP_KEYS.indexOf(step),
    stepCount: BUSINESS_SAVE_STEP_KEYS.length,
    handleSubmit,
  };
}
