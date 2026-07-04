"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import { CompetitorOnboarding } from "./competitor-onboarding";

export interface CompetitorListItem {
  id: string;
  google_place_id: string | null;
  name: string;
  rating: number | null;
  review_count: number | null;
}

export function CompetitorsManager({
  businessId,
  competitors,
  planMaxCompetitors,
}: {
  businessId: string;
  competitors: CompetitorListItem[];
  planMaxCompetitors: number;
}) {
  const t = useTranslations("business.competitors.list");
  const [isManaging, setIsManaging] = useState(false);

  if (isManaging) {
    return (
      <div className="flex flex-col gap-4">
        <CompetitorOnboarding
          businessId={businessId}
          planMaxCompetitors={planMaxCompetitors}
          initialSelectedPlaceIds={competitors
            .map((c) => c.google_place_id)
            .filter((id): id is string => id !== null)}
        />
        <Button
          variant="outline"
          className="max-w-md"
          onClick={() => {
            setIsManaging(false);
          }}
        >
          {t("cancelButton")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <Button
          onClick={() => {
            setIsManaging(true);
          }}
        >
          {t("manageButton")}
        </Button>
      </div>

      {competitors.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {competitors.map((competitor) => (
            <Card key={competitor.id}>
              <CardContent className="flex flex-col gap-1">
                <p className="font-medium">{competitor.name}</p>
                <p className="text-sm text-muted-foreground">{competitor.rating ?? "-"} ★</p>
                <p className="text-xs text-muted-foreground">
                  {t("reviewCount", { count: competitor.review_count ?? 0 })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
