"use client";

import { Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Progress } from "@/components/ui/progress";

// Analiz sürerken gösterilen aşama göstergesi — bkz. docs/03-database.md
// businesses.analysis_stage. AnalysisRunTrigger'dan ayrıldı: o component
// CLAUDE.md'deki 100 satır sınırına dayanmıştı (max-lines-per-function).
export function AnalysisRunProgress({ stepKey, stepIndex, stepCount }: {
  stepKey: string;
  stepIndex: number;
  stepCount: number;
}) {
  const tAnalysis = useTranslations("business.analysis");

  return (
    <div className="flex flex-col gap-2 py-1">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" />
        <span>{tAnalysis(`steps.${stepKey}`)}</span>
      </div>
      <Progress value={((stepIndex + 1) / stepCount) * 100} />
    </div>
  );
}
