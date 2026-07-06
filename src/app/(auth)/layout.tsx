import { Gauge, ListChecks, TrendingUp } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Card, CardContent } from "@/components/ui/card";

export default async function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const t = await getTranslations("auth.branding");

  const bullets = [
    { icon: Gauge, text: t("bullet1") },
    { icon: ListChecks, text: t("bullet2") },
    { icon: TrendingUp, text: t("bullet3") },
  ];

  return (
    <div className="flex flex-1 items-stretch justify-center bg-muted/40">
      <div className="relative hidden w-full max-w-md flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground md:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,color-mix(in_oklch,var(--cta),transparent_60%),transparent_55%),radial-gradient(circle_at_80%_85%,color-mix(in_oklch,var(--gold),transparent_65%),transparent_55%)]"
        />
        <Link href="/" className="relative text-lg font-semibold">
          ClinicRadar
        </Link>
        <div className="relative flex flex-col gap-6">
          <h2 className="text-2xl font-semibold text-balance">{t("headline")}</h2>
          <p className="text-sm text-primary-foreground/80 text-pretty">{t("subheadline")}</p>
          <ul className="flex flex-col gap-3">
            {bullets.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-2.5 text-sm">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary-foreground/10">
                  <Icon className="size-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <span className="relative text-xs text-primary-foreground/60">© {new Date().getFullYear()} ClinicRadar</span>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <Card className="w-full max-w-sm">
          <CardContent className="p-8">{children}</CardContent>
        </Card>
      </div>
    </div>
  );
}
