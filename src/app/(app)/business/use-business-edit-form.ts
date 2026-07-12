"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import type { UpdateBusinessInput } from "@/lib/validations/business";

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

// bkz. use-business-form.ts (create) — aynı colocated-hook deseni, PATCH sürümü.
// google_place_id değiştiğinde route re-enrichment tetikler (lat/lng/rating),
// bu yüzden başarıda router.refresh() ile SSR yeniden çalışır: enrichment artık
// başarılıysa layout "enrichmentFailed" ekranından ilerler.
export function useBusinessEditForm(business: EditableBusiness, onDone?: () => void) {
  const t = useTranslations("business.edit");
  const tErrors = useTranslations("business.errors");
  const router = useRouter();

  const [name, setName] = useState(business.name);
  const [googlePlaceId, setGooglePlaceId] = useState(business.google_place_id ?? "");
  const [category, setCategory] = useState(business.category ?? "");

  const mutation = useMutation({
    mutationFn: (input: UpdateBusinessInput) => updateBusiness(business.id, input),
    onSuccess: () => {
      toast.success(t("success"));
      onDone?.();
      router.refresh();
    },
  });

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    mutation.mutate({
      name,
      google_place_id: googlePlaceId,
      category: category || undefined,
    });
  }

  let errorMessage: string | null = null;
  if (mutation.error) {
    errorMessage = tErrors.has(mutation.error.message) ? tErrors(mutation.error.message) : t("genericError");
    toast.error(errorMessage);
  }

  return {
    name,
    setName,
    googlePlaceId,
    setGooglePlaceId,
    category,
    setCategory,
    errorMessage,
    isPending: mutation.isPending,
    handleSubmit,
  };
}
