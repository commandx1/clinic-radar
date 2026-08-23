import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// business-edit-form.tsx'in 100 satır lint eşiğinin altında kalması için
// ayrı bir dosyaya çıkarıldı (bkz. CLAUDE.md "Component'leri küçük tut").
// Fırsat tahmini kartının $ bandını açan iki opsiyonel girdi — bkz.
// docs/09-task-engine.md "Opportunity Estimate".
export function OpportunityInputsFields({
  avgPatientValueUsd,
  setAvgPatientValueUsd,
  monthlyNewPatients,
  setMonthlyNewPatients,
}: {
  avgPatientValueUsd: string;
  setAvgPatientValueUsd: (value: string) => void;
  monthlyNewPatients: string;
  setMonthlyNewPatients: (value: string) => void;
}) {
  const tForm = useTranslations("business.form");

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <p className="text-sm font-medium">{tForm("opportunity.sectionTitle")}</p>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-business-avg-patient-value">{tForm("opportunity.avgPatientValueLabel")}</Label>
        <Input
          id="edit-business-avg-patient-value"
          type="number"
          min={0}
          step="any"
          inputMode="decimal"
          placeholder={tForm("opportunity.avgPatientValuePlaceholder")}
          value={avgPatientValueUsd}
          onChange={(e) => {
            setAvgPatientValueUsd(e.target.value);
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="edit-business-monthly-new-patients">{tForm("opportunity.monthlyNewPatientsLabel")}</Label>
        <Input
          id="edit-business-monthly-new-patients"
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          placeholder={tForm("opportunity.monthlyNewPatientsPlaceholder")}
          value={monthlyNewPatients}
          onChange={(e) => {
            setMonthlyNewPatients(e.target.value);
          }}
        />
      </div>

      <p className="text-xs text-muted-foreground">{tForm("opportunity.hint")}</p>
    </div>
  );
}
