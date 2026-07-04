"use client";

import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import type { DiscoverResponse } from "@/lib/validations/competitors";

async function fetchDiscoverCandidates(businessId: string): Promise<DiscoverResponse> {
  const res = await fetch(`/api/business/${businessId}/competitors/discover`);

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "discover_failed");
  }

  return (await res.json()) as DiscoverResponse;
}

export function useCompetitorDiscovery(businessId: string) {
  const tErrors = useTranslations("business.competitors.errors");
  const mutation = useMutation({ mutationFn: () => fetchDiscoverCandidates(businessId) });
  const { mutate } = mutation;

  useEffect(() => {
    mutate();
  }, [mutate]);

  let errorMessage: string | null = null;
  if (mutation.error) {
    errorMessage = tErrors.has(mutation.error.message)
      ? tErrors(mutation.error.message)
      : tErrors("genericError");
  }

  return {
    candidates: mutation.data?.candidates ?? [],
    limited: mutation.data?.limited ?? false,
    isPending: mutation.isPending,
    isError: mutation.isError,
    errorMessage,
    retry: () => {
      mutate();
    },
  };
}
