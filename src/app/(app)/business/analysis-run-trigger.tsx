"use client";

import { Loader2Icon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { AnalysisRunProgress } from "./analysis-run-progress";
import { BusinessEditForm } from "./business-edit-form";
import { useAnalysisRunTrigger } from "./use-analysis-run-trigger";

export function AnalysisRunTrigger({
  business,
  isPro,
  nextAnalysisAvailableAt,
  cooldownActive,
}: {
  business: {
    id: string;
    name: string;
    category: string | null;
    google_place_id: string | null;
    last_scraped_at: string | null;
    trustpilot_domain: string | null;
    avg_patient_value_usd: number | null;
    monthly_new_patients: number | null;
  };
  isPro: boolean;
  nextAnalysisAvailableAt: string | null;
  cooldownActive: boolean;
}) {
  const t = useTranslations("business");
  const tAnalysis = useTranslations("business.analysis");
  const tEdit = useTranslations("business.edit");
  const locale = useLocale();
  const [isEditing, setIsEditing] = useState(false);
  const { isPending, errorMessage, stepKey, stepIndex, stepCount, handleRun } = useAnalysisRunTrigger(business.id);

  return (
    <div className="flex max-w-md flex-col gap-2">
      <h1 className="text-xl font-semibold">{t("yourBusiness")}</h1>
      {/* Fırsat tahmini kartındaki "değerlerini gir" CTA'sı buraya link
          verir (bkz. opportunity-estimate-sections.tsx) — işletme
          düzenleme formu ayrı bir route değil, bu kartın "Düzenle"
          butonuyla açılan in-page state'i. */}
      <Card id="business-edit">
        <CardContent className="flex flex-col gap-2">
          {isEditing ? (
            <BusinessEditForm
              business={{
                id: business.id,
                name: business.name,
                google_place_id: business.google_place_id,
                category: business.category,
                trustpilot_domain: business.trustpilot_domain,
                avg_patient_value_usd: business.avg_patient_value_usd,
                monthly_new_patients: business.monthly_new_patients,
              }}
              isPro={isPro}
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

              {isPending && <AnalysisRunProgress stepKey={stepKey} stepIndex={stepIndex} stepCount={stepCount} />}

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
