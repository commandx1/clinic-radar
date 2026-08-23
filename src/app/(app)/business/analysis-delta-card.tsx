import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

import { AnalysisDeltaThemeChips } from "./analysis-delta-theme-chips";
import { resolveAnalysisDelta } from "./resolve-analysis-delta";

// bkz. docs/08-dashboard.md "Bu analizde ne değişti" kartı — Overview'da
// executive özet/istatistik alanının hemen altında gösterilir. Delta taşıyan
// bir run yoksa (hiç analiz çalışmadı ya da tüm run'lar failed) hiçbir şey
// render etmez — boş kart gösterilmez.
export async function AnalysisDeltaCard({ businessId }: { businessId: string }) {
  const supabase = await createClient();
  const [resolved, t, locale] = await Promise.all([
    resolveAnalysisDelta(supabase, businessId),
    getTranslations("business.overview.delta"),
    getLocale(),
  ]);

  if (!resolved) {
    return null;
  }

  const { delta, runFinishedAt } = resolved;
  // `[0] ?? null` yerine `.length` ile korunuyor: `noUncheckedIndexedAccess`
  // kapalı olduğu için TS boş dizide `[0]`'ı hâlâ non-null tipler ve
  // `no-unnecessary-condition` bunu yanlış pozitif olarak işaretler.
  const hasTopCompetitor = delta.competitor_new_reviews_top.length > 0;
  const topCompetitor = delta.competitor_new_reviews_top[0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {new Date(runFinishedAt).toLocaleDateString(locale)} · {t("windowLabel", { days: delta.window_days })}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="flex flex-col gap-1 text-sm">
          <li>
            {t("ownNewReviews", { count: delta.own_new_reviews })},{" "}
            {t("competitorNewReviews", { count: delta.competitor_new_reviews })}
            {hasTopCompetitor
              ? ` — ${t("competitorNewReviewsTop", { name: topCompetitor.name, count: topCompetitor.count })}`
              : null}
          </li>
          <li>
            {t("tasksSummary", {
              created: delta.tasks_created,
              updated: delta.tasks_updated,
              reopened: delta.tasks_reopened,
            })}
          </li>
          <li>
            {t("unrepliedReviews", { count: delta.own_unreplied_reviews })}{" "}
            <Link href="/business/reviews" className="underline underline-offset-2">
              {t("unrepliedReviewsLink")}
            </Link>
          </li>
        </ul>

        <AnalysisDeltaThemeChips
          t={t}
          themesWorsening={delta.themes_worsening}
          themesImproving={delta.themes_improving}
          themesCritical={delta.themes_critical}
        />

        {delta.tasks_created === 0 && delta.zero_new_tasks_reason && (
          <p className="text-sm text-muted-foreground">{t(`zeroTasksReason.${delta.zero_new_tasks_reason}`)}</p>
        )}
      </CardContent>
    </Card>
  );
}
