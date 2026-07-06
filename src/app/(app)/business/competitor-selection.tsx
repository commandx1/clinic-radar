"use client";

import { Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { DiscoverCandidate } from "@/lib/validations/competitors";

import { CompetitorCandidateCard } from "./competitor-candidate-card";
import { useCompetitorSelection } from "./use-competitor-selection";

export function CompetitorSelection({
  businessId,
  candidates,
  limited,
  planMaxCompetitors,
  initialSelectedPlaceIds,
}: {
  businessId: string;
  candidates: DiscoverCandidate[];
  limited: boolean;
  planMaxCompetitors: number;
  initialSelectedPlaceIds?: string[];
}) {
  const t = useTranslations("business.competitors.selection");
  const { selectedIds, visibleSelectedCount, toggle, canSubmit, minRequiredCount, isPending, errorMessage, handleSubmit } =
    useCompetitorSelection(businessId, candidates, planMaxCompetitors, initialSelectedPlaceIds);

  return (
    <div className="flex max-w-md flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle", { max: planMaxCompetitors })}</p>
      </div>

      {limited && <p className="text-sm text-muted-foreground">{t("limitedResults")}</p>}

      <div className="flex flex-col gap-2">
        {candidates.map((candidate) => (
          <CompetitorCandidateCard
            key={candidate.google_place_id}
            candidate={candidate}
            checked={selectedIds.has(candidate.google_place_id)}
            disabled={visibleSelectedCount >= planMaxCompetitors}
            onToggle={(checked) => {
              toggle(candidate.google_place_id, checked);
            }}
          />
        ))}
      </div>

      {!canSubmit && (
        <p className="text-sm text-muted-foreground">
          {t("minRequiredHint", { count: minRequiredCount })}
        </p>
      )}
      {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}

      <Button disabled={!canSubmit || isPending} onClick={handleSubmit}>
        {isPending && <Loader2Icon className="size-4 animate-spin" />}
        {isPending ? t("continueButtonSubmitting") : t("continueButton")}
      </Button>
    </div>
  );
}
