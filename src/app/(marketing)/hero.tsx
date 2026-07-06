import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";

import { GapReadVisual } from "./gap-read-visual";

export async function Hero() {
  const t = await getTranslations("marketing.hero");

  return (
    <section className="mx-auto flex max-w-6xl flex-col items-center gap-12 px-6 py-16 sm:py-24 lg:flex-row lg:items-center lg:gap-20">
      <div className="flex flex-1 flex-col items-start gap-6 text-left">
        <span className="inline-flex items-center rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
          {t("eyebrow")}
        </span>
        <h1 className="font-heading text-4xl leading-tight font-semibold text-balance sm:text-5xl">
          {t("title")}
        </h1>
        <p className="max-w-lg text-lg text-muted-foreground text-balance">{t("subtitle")}</p>
        <div className="flex flex-wrap gap-3">
          <Button variant="cta" size="lg" nativeButton={false} render={<Link href="/signup">{t("ctaPrimary")}</Link>} />
          <Button
            variant="outline"
            size="lg"
            nativeButton={false}
            render={<Link href="#how-it-works">{t("ctaSecondary")}</Link>}
          />
        </div>
      </div>

      <div className="flex flex-1 justify-center">
        <GapReadVisual />
      </div>
    </section>
  );
}
