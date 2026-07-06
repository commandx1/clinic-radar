import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { locales } from "@/i18n/locales";

export async function MarketingHeader() {
  const t = await getTranslations("marketing.nav");
  const locale = await getLocale();

  return (
    <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-heading text-lg font-semibold">
          ClinicRadar
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground sm:flex">
          <Link href="/#features" className="hover:text-foreground">
            {t("features")}
          </Link>
          <Link href="/pricing" className="hover:text-foreground">
            {t("pricing")}
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          {locales.map((l) => (
            <form key={l} action={`/api/locale?locale=${l}`} method="post">
              <Button type="submit" variant={l === locale ? "secondary" : "ghost"} size="sm">
                {l.toUpperCase()}
              </Button>
            </form>
          ))}
          <ThemeToggle />
          <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/login">{t("login")}</Link>} />
          <Button variant="cta" size="sm" nativeButton={false} render={<Link href="/signup">{t("startFree")}</Link>} />
        </div>
      </div>
    </header>
  );
}
