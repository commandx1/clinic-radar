import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

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

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-black/[.08] px-6 py-4 dark:border-white/[.145]">
        <span className="font-semibold">ClinicRadar</span>
        <form action="/auth/signout" method="post">
          <button type="submit" className="text-sm underline">
            {t("signOut")}
          </button>
        </form>
      </header>
      <main className="flex flex-1 flex-col px-6 py-8">{children}</main>
    </div>
  );
}
