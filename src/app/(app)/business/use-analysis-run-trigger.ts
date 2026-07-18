"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface RunAnalysisError extends Error {
  nextAvailableAt?: string;
}

// bkz. docs/03-database.md businesses.analysis_stage, docs/05-ai-pipeline.md
// — execute-analysis.ts pipeline'ın her aşamasında bu sütunu yazar
// (scraping/themes/gap/tasks/summary/null). Mutation pending iken
// /api/business/[id]/analysis/stage endpoint'i kısa aralıklarla poll edilir,
// böylece UI gerçek backend durumunu yansıtır (client-side zamana dayalı
// heuristic yok).
const STAGE_POLL_INTERVAL_MS = 3_000;
const ANALYSIS_STEP_KEYS = ["scraping", "themes", "gap", "tasks", "summary"] as const;
type AnalysisStepKey = (typeof ANALYSIS_STEP_KEYS)[number];

async function runAnalysis(businessId: string): Promise<void> {
  const res = await fetch(`/api/business/${businessId}/analysis/run`, { method: "POST" });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string; nextAvailableAt?: string } | null;
    const error: RunAnalysisError = new Error(body?.error ?? "genericError");
    error.nextAvailableAt = body?.nextAvailableAt;
    throw error;
  }
}

async function fetchStage(businessId: string): Promise<string | null> {
  const res = await fetch(`/api/business/${businessId}/analysis/stage`);

  if (!res.ok) {
    return null;
  }

  const body = (await res.json().catch(() => null)) as { stage?: string | null } | null;
  return body?.stage ?? null;
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
  const [stepKey, setStepKey] = useState<AnalysisStepKey>(ANALYSIS_STEP_KEYS[0]);
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

  // Polling yalnızca isPending true iken çalışır; her yeni çalıştırma
  // handleRun içinde stepKey'i ilk adıma resetler. Effect sadece interval'ı
  // kurup temizlemekten sorumlu, setState her zaman async fetch callback'i
  // içinde çağrılır (effect body'de senkron setState yok).
  useEffect(() => {
    if (!isPending) {
      return;
    }

    const poll = () => {
      fetchStage(businessId)
        .then((stage) => {
          if (stage && (ANALYSIS_STEP_KEYS as readonly string[]).includes(stage)) {
            setStepKey(stage as AnalysisStepKey);
          }
        })
        .catch(() => {
          // best-effort: poll hatası ilerleme göstergesini bozmaz, sadece
          // bir sonraki tick'i bekler.
        });
    };

    poll();
    intervalRef.current = setInterval(poll, STAGE_POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPending, businessId]);

  const errorMessage = mutation.error ? resolveErrorMessage(mutation.error, tErrors) : null;
  const stepIndex = ANALYSIS_STEP_KEYS.indexOf(stepKey);

  return {
    isPending,
    errorMessage,
    stepKey,
    stepIndex,
    stepCount: ANALYSIS_STEP_KEYS.length,
    handleRun: () => {
      setStepKey(ANALYSIS_STEP_KEYS[0]);
      mutation.mutate();
    },
  };
}
