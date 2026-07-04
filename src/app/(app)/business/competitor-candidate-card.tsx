"use client";

import { useTranslations } from "next-intl";

import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import type { DiscoverCandidate } from "@/lib/validations/competitors";

export function CompetitorCandidateCard({
  candidate,
  checked,
  disabled,
  onToggle,
}: {
  candidate: DiscoverCandidate;
  checked: boolean;
  disabled: boolean;
  onToggle: (checked: boolean) => void;
}) {
  const t = useTranslations("business.competitors.selection");

  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-3">
        <Checkbox
          checked={checked}
          disabled={disabled && !checked}
          onCheckedChange={(next) => {
            onToggle(next);
          }}
        />
        <div className="flex flex-1 flex-col">
          <p className="font-medium">{candidate.name}</p>
          <p className="text-sm text-muted-foreground">
            {candidate.rating !== null ? `${String(candidate.rating)} ★` : "—"} ·{" "}
            {t("reviewCount", { count: candidate.review_count ?? 0 })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
