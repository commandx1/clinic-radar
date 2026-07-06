"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

async function login(input: { email: string; password: string }) {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithPassword(input);
  if (error) {throw error;}
}

// Supabase Auth throws raw English error strings (e.g. "Invalid login
// credentials") — map the known ones to translation keys so the UI never
// shows an untranslated string. Unmapped messages fall back to "generic".
function mapAuthErrorCode(message: string): string {
  const knownMessages: Record<string, string> = {
    "Invalid login credentials": "invalidCredentials",
    "Email not confirmed": "emailNotConfirmed",
  };
  return knownMessages[message] ?? "generic";
}

export function useLoginForm() {
  const tErrors = useTranslations("auth.errors");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: () => {
      router.replace("/business");
      router.refresh();
    },
  });

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    mutation.mutate({ email, password });
  }

  let errorMessage: string | null = null;
  if (mutation.error) {
    const code = mapAuthErrorCode(mutation.error.message);
    errorMessage = tErrors.has(code) ? tErrors(code) : tErrors("generic");
  }

  return {
    email,
    setEmail,
    password,
    setPassword,
    errorMessage,
    isPending: mutation.isPending,
    handleSubmit,
  };
}
