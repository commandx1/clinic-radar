"use client";

import { Loader2Icon } from "lucide-react";

import { Progress } from "@/components/ui/progress";

// Genelleştirilmiş aşama göstergesi — bkz. use-analysis-run-trigger.ts ve
// use-business-form.ts başlık yorumları: gösterilen aşama HER ZAMAN gerçek bir
// network sınırını (hangi fetch'in uçtuğunu) yansıtır, client-side zamana
// dayalı fake progress (setTimeout, tahmini yüzde vb.) YOK. Bu component
// sadece render eder — çeviriyi hangi namespace'ten alacağına çağıran karar
// verir (bkz. analysis-run-progress.tsx'teki ince wrapper).
export function StepProgress({
  label,
  stepIndex,
  stepCount,
}: {
  label: string;
  stepIndex: number;
  stepCount: number;
}) {
  return (
    <div className="flex flex-col gap-2 py-1">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" />
        <span>{label}</span>
      </div>
      <Progress value={((stepIndex + 1) / stepCount) * 100} />
    </div>
  );
}
