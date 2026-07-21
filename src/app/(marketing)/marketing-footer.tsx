import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function MarketingFooter() {
  const t = await getTranslations("marketing.footer");
  const tNav = await getTranslations("marketing.nav");

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12 sm:flex-row sm:justify-between">
        <div className="flex flex-col gap-2">
          <span className="font-heading text-lg font-semibold">ClinicRadar</span>
          <p className="max-w-xs text-sm text-muted-foreground">{t("tagline")}</p>
        </div>

        <div className="flex flex-wrap gap-x-16 gap-y-8 text-sm">
          <div className="flex flex-col gap-2">
            <span className="font-medium text-foreground">{t("product")}</span>
            <Link href="/#features" className="text-muted-foreground hover:text-foreground">
              {tNav("features")}
            </Link>
            <Link href="/pricing" className="text-muted-foreground hover:text-foreground">
              {tNav("pricing")}
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-medium text-foreground">{t("account")}</span>
            <Link href="/login" className="text-muted-foreground hover:text-foreground">
              {t("login")}
            </Link>
            <Link href="/signup" className="text-muted-foreground hover:text-foreground">
              {t("signup")}
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            <span className="font-medium text-foreground">{t("legalSection")}</span>
            <Link href="/privacy" className="text-muted-foreground hover:text-foreground">
              {t("privacy")}
            </Link>
            <Link href="/terms" className="text-muted-foreground hover:text-foreground">
              {t("terms")}
            </Link>
            <Link href="/refund-policy" className="text-muted-foreground hover:text-foreground">
              {t("refund")}
            </Link>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-6 pb-8 text-xs text-muted-foreground">
        {t("legal", { year: new Date().getFullYear() })}
      </div>
    </footer>
  );
}
