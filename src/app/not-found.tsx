import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function NotFound() {
  const t = await getTranslations("errors.notFound");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <p className="font-heading text-5xl font-semibold text-primary">404</p>
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      <p className="max-w-sm text-sm text-muted-foreground">{t("description")}</p>
      <Link href="/business" className={cn(buttonVariants(), "mt-2")}>
        {t("action")}
      </Link>
    </div>
  );
}
