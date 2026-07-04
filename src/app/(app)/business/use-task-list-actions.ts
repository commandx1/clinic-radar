"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

type TaskStatus = "done" | "dismissed";

async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<void> {
  const res = await fetch(`/api/tasks/${taskId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "genericError");
  }
}

export function useTaskActions(taskId: string) {
  const tErrors = useTranslations("business.tasks.errors");
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: (status: TaskStatus) => updateTaskStatus(taskId, status),
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

  return {
    isPending: mutation.isPending,
    errorMessage,
    complete: () => {
      mutation.mutate("done");
    },
    dismiss: () => {
      mutation.mutate("dismissed");
    },
  };
}
