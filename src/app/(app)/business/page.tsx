import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";

import { BusinessForm } from "./business-form";

export default async function BusinessPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, google_place_id, category")
    .eq("user_id", user!.id)
    .maybeSingle();

  const t = await getTranslations("business");

  if (business) {
    return (
      <div className="flex max-w-md flex-col gap-2">
        <h1 className="text-xl font-semibold">{t("yourBusiness")}</h1>
        <div className="rounded border border-black/[.08] p-4 dark:border-white/[.145]">
          <p className="font-medium">{business.name}</p>
          {business.category && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{business.category}</p>
          )}
          <p className="mt-2 text-xs text-zinc-500">
            {t("googlePlaceIdLabel")}: {business.google_place_id}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-w-md flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("linkYourBusiness")}</h1>
      <BusinessForm />
    </div>
  );
}
