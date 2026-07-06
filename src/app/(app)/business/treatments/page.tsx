import { StethoscopeIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

interface TreatmentCellData {
  positive_mentions: number;
  negative_mentions: number;
}

type TreatmentsTranslator = (key: string, values?: Record<string, string | number>) => string;

function TreatmentCell({ label, data, t }: { label: string; data: TreatmentCellData | null; t: TreatmentsTranslator }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {data ? (
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant="secondary">{t("positive", { count: data.positive_mentions })}</Badge>
          <Badge variant="destructive">{t("negative", { count: data.negative_mentions })}</Badge>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">-</span>
      )}
    </div>
  );
}

interface TreatmentRow {
  treatment: string;
  own: TreatmentCellData | null;
  competitor: TreatmentCellData | null;
}

// Aynı tedavi türüne (ör. "implant") birden fazla tema satırı ("implant ağrısı",
// "implant randevu süreci") bağlanabilir — bkz. docs/05-ai-pipeline.md Aşama 1.
// Bu sayfa tedavi bazında toplulaştırır, tema kırılımını göstermez (Themes
// sayfası tema kırılımını zaten sağlıyor).
function buildTreatmentRows(
  summaries: { treatment: string | null; owner_type: string; positive_mentions: number; negative_mentions: number }[],
): TreatmentRow[] {
  const byTreatment = new Map<string, TreatmentRow>();

  for (const row of summaries) {
    if (row.treatment === null) {
      continue;
    }
    const existing = byTreatment.get(row.treatment) ?? { treatment: row.treatment, own: null, competitor: null };
    const bucket = row.owner_type === "own" ? "own" : "competitor";
    const cell = existing[bucket] ?? { positive_mentions: 0, negative_mentions: 0 };
    cell.positive_mentions += row.positive_mentions;
    cell.negative_mentions += row.negative_mentions;
    existing[bucket] = cell;
    byTreatment.set(row.treatment, existing);
  }

  return Array.from(byTreatment.values());
}

export default async function TreatmentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", user!.id)
    .maybeSingle();

  // competitor_id IS NULL: toplulaştırılmış rakip satırları — rakip bazlı
  // satırlar (Faz 1.2, görev kartı kanıt satırı için) burada çift saymamak
  // için hariç tutulur, bkz. docs/03-database.md.
  const { data: summaries } = await supabase
    .from("theme_summary")
    .select("treatment, owner_type, positive_mentions, negative_mentions, competitor_id")
    .eq("business_id", business!.id)
    .is("competitor_id", null);

  const t = await getTranslations("business.treatments");
  const rows = buildTreatmentRows(summaries ?? []);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>

      {rows.length === 0 ? (
        <EmptyState icon={StethoscopeIcon} message={t("empty")} />
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <Card key={row.treatment}>
              <CardContent className="flex flex-col gap-2">
                <p className="font-medium">{row.treatment}</p>
                <div className="grid grid-cols-2 gap-3">
                  <TreatmentCell label={t("own")} data={row.own} t={t} />
                  <TreatmentCell label={t("competitorsCombined")} data={row.competitor} t={t} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
