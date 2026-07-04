import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
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
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="font-semibold">ClinicRadar</span>
        <div className="flex items-center gap-2">
          {locales.map((l) => (
            <form key={l} action={`/api/locale?locale=${l}`} method="post">
              <Button type="submit" variant={l === locale ? "secondary" : "ghost"} size="sm">
                {l.toUpperCase()}
              </Button>
            </form>
          ))}
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
