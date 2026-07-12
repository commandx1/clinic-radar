"use client";

import { Loader2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

import { BusinessEditForm } from "./business-edit-form";
import { useAnalysisRunTrigger } from "./use-analysis-run-trigger";

const ANALYSIS_STEP_KEYS = ["scraping", "themes", "comparison", "tasks"] as const;

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
  const tEdit = useTranslations("business.edit");
  const locale = useLocale();
  const [isEditing, setIsEditing] = useState(false);
  const { isPending, errorMessage, stepIndex, stepCount, handleRun } = useAnalysisRunTrigger(business.id);
  const currentStepKey = ANALYSIS_STEP_KEYS[stepIndex] ?? ANALYSIS_STEP_KEYS[ANALYSIS_STEP_KEYS.length - 1];

  return (
    <div className="flex max-w-md flex-col gap-2">
      <h1 className="text-xl font-semibold">{t("yourBusiness")}</h1>
      <Card>
        <CardContent className="flex flex-col gap-2">
          {isEditing ? (
            <BusinessEditForm
              business={{
                id: business.id,
                name: business.name,
                google_place_id: business.google_place_id,
                category: business.category,
              }}
              onCancel={() => {
                setIsEditing(false);
              }}
              onDone={() => {
                setIsEditing(false);
              }}
            />
          ) : (
            <>
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{business.name}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsEditing(true);
                  }}
                >
                  {tEdit("editButton")}
                </Button>
              </div>
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

              {isPending && (
                <div className="flex flex-col gap-2 py-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2Icon className="size-4 animate-spin" />
                    <span>{tAnalysis(`steps.${currentStepKey}`)}</span>
                  </div>
                  <Progress value={((stepIndex + 1) / stepCount) * 100} />
                </div>
              )}

              <Button
                disabled={isPending || cooldownActive}
                onClick={() => {
                  handleRun();
                }}
              >
                {isPending && <Loader2Icon className="size-4 animate-spin" />}
                {isPending ? tAnalysis("runButtonPending") : tAnalysis("runButton")}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
