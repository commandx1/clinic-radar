"use client";

import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

async function signup(input: { email: string; password: string }) {
  const supabase = createClient();
  const { error } = await supabase.auth.signUp({
    ...input,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  if (error) {throw error;}
}

// Supabase Auth throws raw English error strings (e.g. "User already
// registered") — map the known ones to translation keys so the UI never
// shows an untranslated string. Unmapped messages fall back to "generic".
function mapAuthErrorCode(message: string): string {
  const knownMessages: Record<string, string> = {
    "User already registered": "userAlreadyRegistered",
    "Password should be at least 6 characters.": "weakPassword",
  };
  return knownMessages[message] ?? "generic";
}

export function useSignupForm() {
  const tErrors = useTranslations("auth.errors");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const mutation = useMutation({ mutationFn: signup });

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
    isSuccess: mutation.isSuccess,
    handleSubmit,
  };
}
