"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const t = useTranslations("auth.login");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.replace("/business");
    router.refresh();
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
        {t("noAccount")}{" "}
        <Link href="/signup" className="font-medium underline">
          {t("signupLink")}
        </Link>
      </p>
    </form>
  );
}
