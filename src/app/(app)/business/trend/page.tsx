import { TrendingUpIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/empty-state";
import { createClient } from "@/lib/supabase/server";

import { TrendChart } from "../trend-chart";

export default async function TrendPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", user!.id)
    .maybeSingle();

  // snapshots sorgusu ve çeviriler bağımsız — paralel çalıştır.
  const [{ data: snapshots }, t] = await Promise.all([
    supabase
      .from("clinic_score_history")
      .select("score, competitor_rank, snapshot_at")
      .eq("business_id", business!.id)
      .order("snapshot_at", { ascending: true }),
    getTranslations("business.trend"),
  ]);
  const points = (snapshots ?? []).map((s) => ({
    snapshotAt: s.snapshot_at,
    score: s.score,
    competitorRank: s.competitor_rank,
  }));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>
      {points.length < 2 ? (
        <EmptyState icon={TrendingUpIcon} message={t("notEnoughData")} />
      ) : (
        <TrendChart points={points} />
      )}
    </div>
  );
}
