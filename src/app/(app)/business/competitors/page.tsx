import { FREE_PLAN_MAX_COMPETITORS, PRO_PLAN_MAX_COMPETITORS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

import { CompetitorsManager } from "../competitors-manager";

export default async function CompetitorsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // business ve subscription ikisi de user.id'ye bağlı — paralel çalıştır.
  const [{ data: business }, { data: subscription }] = await Promise.all([
    supabase.from("businesses").select("id").eq("user_id", user!.id).maybeSingle(),
    supabase.from("subscriptions").select("plan").eq("user_id", user!.id).maybeSingle(),
  ]);

  const { data: competitors } = await supabase
    .from("competitors")
    .select("id, google_place_id, name, rating, review_count")
    .eq("business_id", business!.id);
  const planMaxCompetitors = subscription?.plan === "pro" ? PRO_PLAN_MAX_COMPETITORS : FREE_PLAN_MAX_COMPETITORS;

  return (
    <CompetitorsManager
      businessId={business!.id}
      competitors={competitors ?? []}
      planMaxCompetitors={planMaxCompetitors}
    />
  );
}
