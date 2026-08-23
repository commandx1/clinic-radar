import { getLocale, getTranslations } from "next-intl/server";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

import {
  OpportunityFilterWarning,
  OpportunityRatingGapRow,
  OpportunityRevenueSection,
  OpportunityVelocityRow,
} from "./opportunity-estimate-sections";
import { resolveOpportunityEstimate } from "./resolve-opportunity-estimate";

// bkz. docs/08-dashboard.md "Fırsat tahmini" kartı, docs/09-task-engine.md
// "Opportunity Estimate" — Overview'da AnalysisDeltaCard'ın hemen altında.
// Sonuç HER ZAMAN bantlı gösterilir, asla kesin bir öngörü değildir (CLAUDE.md,
// docs/10-roadmap.md "asla '+0.18 yıldız' gibi kesin tahmin verilmez"). Own ve
// rakip puanı arasında kıyaslanabilir hiçbir veri yoksa (ratingGap null) VE
// yorum hızı da kıyaslanamıyorsa (reviewVelocityRatio null) kart hiç render
// edilmez — boş kart gösterilmez.
export async function OpportunityEstimateCard({ businessId }: { businessId: string }) {
  const supabase = await createClient();
  const [{ estimate, ownRating }, t, locale] = await Promise.all([
    resolveOpportunityEstimate(supabase, businessId),
    getTranslations("business.overview.opportunity"),
    getLocale(),
  ]);

  if (estimate.ratingGap === null && estimate.reviewVelocityRatio === null) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <p className="text-xs text-muted-foreground">{t("methodNote")}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <OpportunityRatingGapRow t={t} ownRating={ownRating} estimate={estimate} />
        <OpportunityRevenueSection t={t} estimate={estimate} locale={locale} />
        <OpportunityFilterWarning t={t} estimate={estimate} />
        <OpportunityVelocityRow t={t} estimate={estimate} />
      </CardContent>
    </Card>
  );
}
