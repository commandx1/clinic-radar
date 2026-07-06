"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import type { CreateBusinessInput } from "@/lib/validations/business";

async function createBusiness(input: CreateBusinessInput): Promise<void> {
  const res = await fetch("/api/business", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "insert_failed");
  }
}

export function useBusinessForm() {
  const t = useTranslations("business.form");
  const tErrors = useTranslations("business.errors");
  const router = useRouter();

  const [name, setName] = useState("");
  const [googlePlaceId, setGooglePlaceId] = useState("");
  const [category, setCategory] = useState("");
  const [currentTool, setCurrentTool] = useState("");

  const mutation = useMutation({
    mutationFn: createBusiness,
    onSuccess: () => {
      toast.success(t("success"));
      router.refresh();
    },
  });

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    mutation.mutate({
      name,
      google_place_id: googlePlaceId,
      category: category || undefined,
      current_tool: currentTool,
    });
  }

  let errorMessage: string | null = null;
  if (mutation.error) {
    errorMessage = tErrors.has(mutation.error.message)
      ? tErrors(mutation.error.message)
      : t("genericError");
    toast.error(errorMessage);
  }

  return {
    name,
    setName,
    googlePlaceId,
    setGooglePlaceId,
    category,
    setCategory,
    currentTool,
    setCurrentTool,
    errorMessage,
    isPending: mutation.isPending,
    handleSubmit,
  };
}
