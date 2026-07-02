"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

export function BusinessForm() {
  const t = useTranslations("business.form");
  const tErrors = useTranslations("business.errors");
  const router = useRouter();
  const [name, setName] = useState("");
  const [googlePlaceId, setGooglePlaceId] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/business", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        google_place_id: googlePlaceId,
        category: category || undefined,
      }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(
        body?.error === "already_linked" ? tErrors("already_linked") : t("genericError"),
      );
      return;
    }

    router.refresh();
  }

  return (
    <form
      onSubmit={(e) => {
        void handleSubmit(e);
      }}
      className="flex flex-col gap-4"
    >
      <label className="flex flex-col gap-1 text-sm">
        {t("name")}
        <input
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
          }}
          className="rounded border border-black/[.15] px-3 py-2 dark:border-white/[.2] dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        {t("googlePlaceId")}
        <input
          required
          value={googlePlaceId}
          onChange={(e) => {
            setGooglePlaceId(e.target.value);
          }}
          className="rounded border border-black/[.15] px-3 py-2 dark:border-white/[.2] dark:bg-zinc-900"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        {t("category")}
        <input
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
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
    </form>
  );
}
