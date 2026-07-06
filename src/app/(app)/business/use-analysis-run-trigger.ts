"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface RunAnalysisError extends Error {
  nextAvailableAt?: string;
}

// Sunucu tarafında gerçek per-aşama ilerleme sinyali yok (bkz. route.ts'teki
// yorum: Apify + Claude/Gemini aşamaları tek bir senkron istek/yanıt içinde
// çalışır, SSE/polling altyapısı yok). Bu adımlar sadece client-side,
// zamana dayalı bir sezgisel (heuristic) ilerleme göstergesidir — gerçek
// backend durumunu yansıtmaz, yalnızca algılanan bekleme süresini kısaltmak
// içindir.
const STEP_INTERVAL_MS = 50_000;
const ANALYSIS_STEP_COUNT = 4;

async function runAnalysis(businessId: string): Promise<void> {
  const res = await fetch(`/api/business/${businessId}/analysis/run`, { method: "POST" });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string; nextAvailableAt?: string } | null;
    const error: RunAnalysisError = new Error(body?.error ?? "genericError");
    error.nextAvailableAt = body?.nextAvailableAt;
    throw error;
  }
}

function resolveErrorMessage(error: RunAnalysisError, tErrors: ReturnType<typeof useTranslations>): string {
  if (error.message === "analysis_cooldown_active" && error.nextAvailableAt) {
    return tErrors("analysis_cooldown_active", {
      date: new Date(error.nextAvailableAt).toLocaleDateString(),
    });
  }
  if (tErrors.has(error.message)) {
    return tErrors(error.message);
  }
  return tErrors("genericError");
}

export function useAnalysisRunTrigger(businessId: string) {
  const tErrors = useTranslations("business.analysis.errors");
  const tAnalysis = useTranslations("business.analysis");
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const mutation = useMutation({
    mutationFn: () => runAnalysis(businessId),
    onSuccess: () => {
      toast.success(tAnalysis("completeToast"));
      router.refresh();
    },
    onError: (error) => {
      toast.error(resolveErrorMessage(error, tErrors));
    },
  });
  const { isPending } = mutation;

  // Adımlar sadece isPending true iken ilerler; her yeni çalıştırma
  // handleRun içinde stepIndex'i 0'a resetler, effect ise yalnızca
  // interval'ı kurup temizlemekten sorumlu (setState effect body'de
  // senkron çağrılmaz, sadece timer callback'i içinde çağrılır).
  useEffect(() => {
    if (!isPending) {
      return;
    }

    intervalRef.current = setInterval(() => {
      setStepIndex((prev) => Math.min(prev + 1, ANALYSIS_STEP_COUNT - 1));
    }, STEP_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPending]);

  const errorMessage = mutation.error ? resolveErrorMessage(mutation.error, tErrors) : null;

  return {
    isPending,
    errorMessage,
    stepIndex,
    stepCount: ANALYSIS_STEP_COUNT,
    handleRun: () => {
      setStepIndex(0);
      mutation.mutate();
    },
  };
}
