import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";

export async function CtaBand() {
  const t = await getTranslations("marketing.ctaBand");

  return (
    <section className="bg-primary">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-16 text-center sm:py-20">
        <h2 className="font-heading max-w-2xl text-3xl font-semibold text-balance text-primary-foreground">
          {t("title")}
        </h2>
        <Button variant="cta" size="lg" nativeButton={false} render={<Link href="/signup">{t("cta")}</Link>} />
      </div>
    </section>
  );
}
