import { getTranslations } from "next-intl/server";

import { FREE_PLAN_MAX_COMPETITORS, MIN_COMPETITORS, PRO_PLAN_MAX_COMPETITORS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

import { BusinessForm } from "./business-form";
import { CompetitorOnboarding } from "./competitor-onboarding";
import { EnrichmentFailedNotice } from "./enrichment-failed-notice";
import { NavTabs } from "./nav-tabs";

export default async function BusinessLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: business } = await supabase
    .from("businesses")
    .select("id, lat, lng")
    .eq("user_id", user!.id)
    .maybeSingle();

  const t = await getTranslations("business");

  if (!business) {
    return (
      <div className="flex max-w-md flex-col gap-4">
        <h1 className="text-xl font-semibold">{t("linkYourBusiness")}</h1>
        <BusinessForm />
      </div>
    );
  }

  if (business.lat === null || business.lng === null) {
    return <EnrichmentFailedNotice />;
  }

  const { count: competitorCount } = await supabase
    .from("competitors")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id);

  if ((competitorCount ?? 0) < MIN_COMPETITORS) {
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("plan")
      .eq("user_id", user!.id)
      .maybeSingle();
    const planMaxCompetitors =
      subscription?.plan === "pro" ? PRO_PLAN_MAX_COMPETITORS : FREE_PLAN_MAX_COMPETITORS;

    return <CompetitorOnboarding businessId={business.id} planMaxCompetitors={planMaxCompetitors} />;
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <NavTabs />
      {children}
    </div>
  );
}
