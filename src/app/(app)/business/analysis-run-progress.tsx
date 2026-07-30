"use client";

import { useTranslations } from "next-intl";

import { StepProgress } from "./step-progress";

// Analiz sürerken gösterilen aşama göstergesi — bkz. docs/03-database.md
// businesses.analysis_stage. Render mantığı StepProgress'e taşındı (bkz. o
// dosyanın başlık yorumu); bu component sadece business.analysis çeviri
// namespace'ini StepProgress'e bağlayan ince bir wrapper. AnalysisRunTrigger'ın
// bu component'e geçtiği prop'lar (stepKey/stepIndex/stepCount) değişmedi.
export function AnalysisRunProgress({
  stepKey,
  stepIndex,
  stepCount,
}: {
  stepKey: string;
  stepIndex: number;
  stepCount: number;
}) {
  const tAnalysis = useTranslations("business.analysis");

  return <StepProgress label={tAnalysis(`steps.${stepKey}`)} stepIndex={stepIndex} stepCount={stepCount} />;
}
