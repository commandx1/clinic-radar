import { hasProAccess } from "@/lib/billing/plan-access";
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
    supabase
      .from("subscriptions")
      .select("plan, status, current_period_end")
      .eq("user_id", user!.id)
      .maybeSingle(),
  ]);

  const { data: competitors } = await supabase
    .from("competitors")
    .select(
      "id, google_place_id, name, rating, review_count, recent_rating, recent_rating_reviews, recent_rating_window_days",
    )
    .eq("business_id", business!.id);
  const planMaxCompetitors = hasProAccess(subscription) ? PRO_PLAN_MAX_COMPETITORS : FREE_PLAN_MAX_COMPETITORS;

  return (
    <CompetitorsManager
      businessId={business!.id}
      competitors={competitors ?? []}
      planMaxCompetitors={planMaxCompetitors}
    />
  );
}
