"use client";

import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { useAnalysisRunTrigger } from "./use-analysis-run-trigger";

export function AnalysisRunTrigger({
  business,
  nextAnalysisAvailableAt,
  cooldownActive,
}: {
  business: {
    id: string;
    name: string;
    category: string | null;
    google_place_id: string | null;
    last_scraped_at: string | null;
  };
  nextAnalysisAvailableAt: string | null;
  cooldownActive: boolean;
}) {
  const t = useTranslations("business");
  const tAnalysis = useTranslations("business.analysis");
  const locale = useLocale();
  const { isPending, errorMessage, handleRun } = useAnalysisRunTrigger(business.id);

  return (
    <div className="flex max-w-md flex-col gap-2">
      <h1 className="text-xl font-semibold">{t("yourBusiness")}</h1>
      <Card>
        <CardContent className="flex flex-col gap-2">
          <p className="font-medium">{business.name}</p>
          {business.category && <p className="text-sm text-muted-foreground">{business.category}</p>}
          <p className="text-xs text-muted-foreground">
            {t("googlePlaceIdLabel")}: {business.google_place_id}
          </p>
          <p className="text-sm text-muted-foreground">
            {business.last_scraped_at
              ? tAnalysis("lastScrapedAt", { date: new Date(business.last_scraped_at).toLocaleDateString(locale) })
              : tAnalysis("neverScraped")}
          </p>

          {cooldownActive && nextAnalysisAvailableAt && (
            <p className="text-sm text-muted-foreground">
              {tAnalysis("cooldownNotice", { date: new Date(nextAnalysisAvailableAt).toLocaleDateString(locale) })}
            </p>
          )}

          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

          <Button
            disabled={isPending || cooldownActive}
            onClick={() => {
              handleRun();
            }}
          >
            {isPending ? tAnalysis("runButtonPending") : tAnalysis("runButton")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
