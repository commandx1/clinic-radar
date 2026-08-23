import { Badge } from "@/components/ui/badge";
import type { AnalysisDeltaAlert } from "@/lib/analysis/analysis-delta";

type DeltaTranslator = (key: string, values?: Record<string, string | number>) => string;

// bkz. docs/02-business-rules.md Bölüm G kural 4/5/6, docs/08-dashboard.md
// "Bu analizde ne değişti" kartı — her alert türünün kendi i18n şablonu var
// (business.overview.delta.alerts.<type>, bkz. messages/{tr,en}.json),
// değişkenler `alert.detail`den (snake_case, competitor-alerts.ts'te
// üretilir) + `competitor_name`den doğrudan geçirilir.
function AlertBadge({ alert, t }: { alert: AnalysisDeltaAlert; t: DeltaTranslator }) {
  const text = t(`alerts.${alert.type}`, { name: alert.competitor_name, ...alert.detail });
  return <Badge variant="destructive">{text}</Badge>;
}

// Boşsa (alerts undefined/[] — eski delta satırları ya da bu döngüde hiç
// uyarı yoksa) hiç render edilmez, kart gereksiz yere büyümez.
export function AnalysisDeltaAlerts({
  t,
  alerts,
}: {
  t: DeltaTranslator;
  alerts: AnalysisDeltaAlert[] | undefined;
}) {
  if (!alerts || alerts.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{t("alerts.title")}</span>
      <div className="flex flex-wrap gap-1">
        {alerts.map((alert, index) => (
          <AlertBadge key={`${alert.type}-${alert.competitor_name}-${String(index)}`} alert={alert} t={t} />
        ))}
      </div>
    </div>
  );
}
