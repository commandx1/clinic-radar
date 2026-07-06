"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

type TaskStatus = "done" | "dismissed";

async function patchTask(taskId: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const resBody = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(resBody?.error ?? "genericError");
  }
}

export function useTaskActions(taskId: string) {
  const tErrors = useTranslations("business.tasks.errors");
  const tToasts = useTranslations("business.tasks.toasts");
  const router = useRouter();
  const [optimisticallyResolved, setOptimisticallyResolved] = useState(false);

  const mutation = useMutation({
    mutationFn: (status: TaskStatus) => patchTask(taskId, { status }),
    onSuccess: (_data, status) => {
      toast.success(status === "done" ? tToasts("completed") : tToasts("dismissed"));
      router.refresh();
    },
    onError: () => {
      setOptimisticallyResolved(false);
    },
  });

  let errorMessage: string | null = null;
  if (mutation.error) {
    errorMessage = tErrors.has(mutation.error.message)
      ? tErrors(mutation.error.message)
      : tErrors("genericError");
  }

  return {
    isPending: mutation.isPending,
    errorMessage,
    optimisticallyResolved,
    complete: () => {
      setOptimisticallyResolved(true);
      mutation.mutate("done");
    },
    dismiss: () => {
      setOptimisticallyResolved(true);
      mutation.mutate("dismissed");
    },
  };
}

// bkz. docs/10-roadmap.md — checklist alt adımı tiklemek görev "status"unu
// etkilemez, ayrı bir mutation olarak yönetilir; her satır kendi index'ini
// bilir (backend checklistIndex bekliyor).
export function useTaskChecklistToggle(taskId: string) {
  const tErrors = useTranslations("business.tasks.errors");
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: (input: { checklistIndex: number; done: boolean }) =>
      patchTask(taskId, input),
    onSuccess: () => {
      router.refresh();
    },
  });

  let errorMessage: string | null = null;
  if (mutation.error) {
    errorMessage = tErrors.has(mutation.error.message)
      ? tErrors(mutation.error.message)
      : tErrors("genericError");
  }

  const pendingVariables = mutation.isPending ? mutation.variables : undefined;

  return {
    pendingIndex: pendingVariables ? pendingVariables.checklistIndex : null,
    errorMessage,
    toggle: (checklistIndex: number, done: boolean) => {
      mutation.mutate({ checklistIndex, done });
    },
  };
}
