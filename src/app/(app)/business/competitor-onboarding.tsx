"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { CompetitorSelection } from "./competitor-selection";
import { useCompetitorDiscovery } from "./use-competitor-discovery";

export function CompetitorOnboarding({
  businessId,
  planMaxCompetitors,
  initialSelectedPlaceIds,
}: {
  businessId: string;
  planMaxCompetitors: number;
  initialSelectedPlaceIds?: string[];
}) {
  const t = useTranslations("business.competitors");
  const { candidates, limited, isPending, isError, errorMessage, retry } =
    useCompetitorDiscovery(businessId);

  if (isPending) {
    return (
      <div className="flex max-w-md flex-col gap-2">
        <h1 className="text-xl font-semibold">{t("discovering.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("discovering.subtitle")}</p>
      </div>
    );
  }

  if (isError) {
    return (
      <Card className="max-w-md">
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-destructive">{errorMessage}</p>
          <Button
            onClick={() => {
              retry();
            }}
          >
            {t("selection.retry")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <CompetitorSelection
      businessId={businessId}
      candidates={candidates}
      limited={limited}
      planMaxCompetitors={planMaxCompetitors}
      initialSelectedPlaceIds={initialSelectedPlaceIds}
    />
  );
}
