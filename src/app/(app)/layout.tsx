import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { locales } from "@/i18n/locales";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const t = await getTranslations("app");
  const locale = await getLocale();

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/85 px-6 py-4 backdrop-blur-sm supports-backdrop-filter:bg-background/70">
        <Link href="/business" className="font-heading font-semibold text-primary">
          ClinicRadar
        </Link>
        <div className="flex items-center gap-2">
          {locales.map((l) => (
            <form key={l} action={`/api/locale?locale=${l}`} method="post">
              <Button type="submit" variant={l === locale ? "secondary" : "ghost"} size="sm">
                {l.toUpperCase()}
              </Button>
            </form>
          ))}
          <Separator orientation="vertical" className="mx-1 h-5" />
          <ThemeToggle />
          <form action="/auth/signout" method="post">
            <Button type="submit" variant="ghost" size="sm">
              {t("signOut")}
            </Button>
          </form>
        </div>
      </header>
      <main className="flex flex-1 flex-col px-6 py-8">{children}</main>
    </div>
  );
}
