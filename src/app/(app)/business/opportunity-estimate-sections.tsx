import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { OPPORTUNITY_VELOCITY_WINDOW_DAYS } from "@/lib/constants";
import type { OpportunityEstimate } from "@/lib/task-engine/opportunity-estimate";

// AnalysisDeltaThemeChips'teki DeltaTranslator ile aynı desen: alt
// component'lere tam next-intl tipi yerine yapısal olarak uyumlu, gevşek bir
// fonksiyon tipi geçiriyoruz.
export type OpportunityTranslator = (key: string, values?: Record<string, string | number>) => string;

// İşletme düzenleme formu ayrı bir route değil — Overview'ın en üstündeki
// kartın "Düzenle" state'i (bkz. analysis-run-trigger.tsx id="business-edit").
const BUSINESS_EDIT_ANCHOR = "/business#business-edit";

function GapBadge({ t, gap }: { t: OpportunityTranslator; gap: number }) {
  if (gap > 0) {
    return <Badge variant="destructive">{t("gapBehind", { value: gap.toFixed(1) })}</Badge>;
  }
  if (gap < 0) {
    return <Badge variant="secondary">{t("gapAhead", { value: Math.abs(gap).toFixed(1) })}</Badge>;
  }
  return <Badge variant="outline">{t("gapEven")}</Badge>;
}

export function OpportunityRatingGapRow({
  t,
  ownRating,
  estimate,
}: {
  t: OpportunityTranslator;
  ownRating: number | null;
  estimate: OpportunityEstimate;
}) {
  if (ownRating === null || estimate.competitorMedianRating === null || estimate.ratingGap === null) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>
        {t("ratingComparison", { own: ownRating.toFixed(1), competitor: estimate.competitorMedianRating.toFixed(1) })}
      </span>
      <GapBadge t={t} gap={estimate.ratingGap} />
    </div>
  );
}

export function OpportunityRevenueSection({
  t,
  estimate,
  locale,
}: {
  t: OpportunityTranslator;
  estimate: OpportunityEstimate;
  locale: string;
}) {
  if (estimate.revenueUpliftPctRange === null) {
    return null;
  }
  const [minPct, maxPct] = estimate.revenueUpliftPctRange;
  const numberFormat = new Intl.NumberFormat(locale);

  return (
    <div className="flex flex-col gap-1">
      <p>{t("revenueUplift", { min: minPct.toFixed(1), max: maxPct.toFixed(1) })}</p>
      <p className="text-xs text-muted-foreground">{t("revenueUpliftHint")}</p>
      {estimate.annualRevenueUsdRange ? (
        <p className="font-medium">
          {t("annualRevenue", {
            min: numberFormat.format(estimate.annualRevenueUsdRange[0]),
            max: numberFormat.format(estimate.annualRevenueUsdRange[1]),
          })}
        </p>
      ) : (
        <Link href={BUSINESS_EDIT_ANCHOR} className="text-sm underline underline-offset-2">
          {t("annualRevenueCta")}
        </Link>
      )}
    </div>
  );
}

export function OpportunityFilterWarning({
  t,
  estimate,
}: {
  t: OpportunityTranslator;
  estimate: OpportunityEstimate;
}) {
  if (!estimate.belowFilterThreshold) {
    return null;
  }
  return <Badge variant="destructive">{t("belowThresholdWarning")}</Badge>;
}

export function OpportunityVelocityRow({ t, estimate }: { t: OpportunityTranslator; estimate: OpportunityEstimate }) {
  if (estimate.ownReviewsPerMonth === 0 && estimate.competitorAvgReviewsPerMonth === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span>
        {t("velocityLine", {
          days: OPPORTUNITY_VELOCITY_WINDOW_DAYS,
          own: estimate.ownReviewsPerMonth.toFixed(1),
          competitor: estimate.competitorAvgReviewsPerMonth.toFixed(1),
        })}
      </span>
      {estimate.velocityGap && <Badge variant="destructive">{t("velocityWarning")}</Badge>}
    </div>
  );
}
