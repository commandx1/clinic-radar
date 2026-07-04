"use client";

import { useMutation } from "@tanstack/react-query";
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

export function useSignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const mutation = useMutation({ mutationFn: signup });

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    mutation.mutate({ email, password });
  }

  return {
    email,
    setEmail,
    password,
    setPassword,
    errorMessage: mutation.error?.message ?? null,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    handleSubmit,
  };
}
