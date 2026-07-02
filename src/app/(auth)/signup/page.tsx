"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const t = useTranslations("auth.signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">{t("checkEmailTitle")}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("checkEmailBody")}</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
      className="flex flex-col gap-4"
    >
      <h1 className="text-xl font-semibold">{t("title")}</h1>

      <label className="flex flex-col gap-1 text-sm">
        {t("email")}
        <input
          type="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
          }}
          className="rounded border border-black/[.15] px-3 py-2 dark:border-white/[.2] dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        {t("password")}
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
          }}
          className="rounded border border-black/[.15] px-3 py-2 dark:border-white/[.2] dark:bg-zinc-900"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="rounded bg-foreground px-4 py-2 text-background disabled:opacity-50"
      >
        {loading ? t("submitting") : t("submit")}
      </button>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {t("hasAccount")}{" "}
        <Link href="/login" className="font-medium underline">
          {t("loginLink")}
        </Link>
      </p>
    </form>
  );
}
