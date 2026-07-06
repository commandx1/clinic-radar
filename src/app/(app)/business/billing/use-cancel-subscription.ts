"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

async function cancelSubscription(): Promise<void> {
  const res = await fetch("/api/billing/cancel", { method: "POST" });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "genericError");
  }
}

export function useCancelSubscription() {
  const t = useTranslations("business.billing.cancel");
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: cancelSubscription,
    onSuccess: () => {
      toast.success(t("toasts.success"));
      setIsDialogOpen(false);
      router.refresh();
    },
  });

  let errorMessage: string | null = null;
  if (mutation.error) {
    errorMessage = t.has(`errors.${mutation.error.message}`)
      ? t(`errors.${mutation.error.message}`)
      : t("errors.genericError");
  }

  return {
    isDialogOpen,
    setIsDialogOpen,
    isPending: mutation.isPending,
    errorMessage,
    confirm: () => {
      mutation.mutate();
    },
  };
}
