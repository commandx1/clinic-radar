"use client";

import { Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";

import { CompetitorSelection } from "./competitor-selection";
import { useCompetitorDiscovery } from "./use-competitor-discovery";

const DISCOVERY_SKELETON_COUNT = 4;

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
      <div className="flex max-w-md flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
            <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
            <div className="flex flex-col gap-1">
              <h1 className="text-xl font-semibold">{t("discovering.title")}</h1>
              <p className="text-sm text-muted-foreground">{t("discovering.subtitle")}</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-2">
          {Array.from({ length: DISCOVERY_SKELETON_COUNT }, (_, index) => (
            <Card key={index} size="sm">
              <CardContent className="flex items-center gap-3">
                <Checkbox disabled checked={false} />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
