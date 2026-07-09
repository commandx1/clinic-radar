"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors.boundary");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{t("description")}</p>
      {error.digest ? (
        <p className="text-xs text-muted-foreground/70">#{error.digest}</p>
      ) : null}
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <Button onClick={reset}>{t("retry")}</Button>
        <Link href="/business" className={cn(buttonVariants({ variant: "outline" }))}>
          {t("home")}
        </Link>
      </div>
    </div>
  );
}
