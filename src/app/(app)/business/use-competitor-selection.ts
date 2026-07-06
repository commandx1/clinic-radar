"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { MIN_COMPETITORS } from "@/lib/constants";
import type { DiscoverCandidate } from "@/lib/validations/competitors";

async function saveCompetitors(businessId: string, candidates: DiscoverCandidate[]): Promise<void> {
  const res = await fetch(`/api/business/${businessId}/competitors`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidates }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "save_failed");
  }
}

export function useCompetitorSelection(
  businessId: string,
  candidates: DiscoverCandidate[],
  planMaxCompetitors: number,
  initialSelectedPlaceIds: string[] = [],
) {
  const t = useTranslations("business.competitors.selection");
  const tErrors = useTranslations("business.competitors.errors");
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelectedPlaceIds));

  const selectedCandidates = candidates.filter((c) => selectedIds.has(c.google_place_id));
  // "Manage" akışında initialSelectedPlaceIds önceki seçimden gelir ama yeni
  // bir keşif taraması aynı adayları döndürmeyi garanti etmez. Sayım/kapasite
  // kontrollerinde ham selectedIds.size yerine görünür adaylarla kesişimi
  // kullanıyoruz — yoksa listede hiç görünmeyen bir id planMaxCompetitors
  // sayacını doldurup tüm checkbox'ları kilitleyebilir.
  const visibleSelectedCount = selectedCandidates.length;

  function toggle(placeId: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        if (visibleSelectedCount >= planMaxCompetitors) {
          return prev;
        }
        next.add(placeId);
      } else {
        next.delete(placeId);
      }
      return next;
    });
  }

  const mutation = useMutation({
    mutationFn: () => saveCompetitors(businessId, selectedCandidates),
    onSuccess: () => {
      toast.success(t("saveSuccessToast"));
      router.refresh();
    },
    onError: (error) => {
      toast.error(tErrors.has(error.message) ? tErrors(error.message) : tErrors("genericError"));
    },
  });

  let errorMessage: string | null = null;
  if (mutation.error) {
    errorMessage = tErrors.has(mutation.error.message)
      ? tErrors(mutation.error.message)
      : tErrors("genericError");
  }

  return {
    selectedIds,
    visibleSelectedCount,
    toggle,
    canSubmit: visibleSelectedCount >= MIN_COMPETITORS,
    minRequiredCount: Math.max(0, MIN_COMPETITORS - visibleSelectedCount),
    isPending: mutation.isPending,
    errorMessage,
    handleSubmit: () => {
      mutation.mutate();
    },
  };
}
