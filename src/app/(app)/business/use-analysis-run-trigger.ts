"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface RunAnalysisError extends Error {
  nextAvailableAt?: string;
}

async function runAnalysis(businessId: string): Promise<void> {
  const res = await fetch(`/api/business/${businessId}/analysis/run`, { method: "POST" });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string; nextAvailableAt?: string } | null;
    const error: RunAnalysisError = new Error(body?.error ?? "genericError");
    error.nextAvailableAt = body?.nextAvailableAt;
    throw error;
  }
}

export function useAnalysisRunTrigger(businessId: string) {
  const tErrors = useTranslations("business.analysis.errors");
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: () => runAnalysis(businessId),
    onSuccess: () => {
      router.refresh();
    },
  });

  let errorMessage: string | null = null;
  if (mutation.error) {
    const error = mutation.error as RunAnalysisError;
    if (error.message === "analysis_cooldown_active" && error.nextAvailableAt) {
      errorMessage = tErrors("analysis_cooldown_active", {
        date: new Date(error.nextAvailableAt).toLocaleDateString(),
      });
    } else {
      errorMessage = tErrors.has(error.message) ? tErrors(error.message) : tErrors("genericError");
    }
  }

  return {
    isPending: mutation.isPending,
    errorMessage,
    handleRun: () => {
      mutation.mutate();
    },
  };
}
