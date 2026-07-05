import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

type TrendKey = "trend.improving" | "trend.worsening" | "trend.stable";

interface ThemeCellData {
  positive_mentions: number | null;
  negative_mentions: number | null;
  trend: string | null;
}

type ThemesTranslator = (key: string, values?: Record<string, string | number>) => string;

function ThemeCell({ label, data, t }: { label: string; data: ThemeCellData | null; t: ThemesTranslator }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {data ? (
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant="secondary">{t("positive", { count: data.positive_mentions ?? 0 })}</Badge>
          <Badge variant="destructive">{t("negative", { count: data.negative_mentions ?? 0 })}</Badge>
          {data.trend && <span className="text-xs text-muted-foreground">{t(`trend.${data.trend}` as TrendKey)}</span>}
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">-</span>
      )}
    </div>
  );
}

interface ThemeRow {
  theme: string;
  own: { positive_mentions: number | null; negative_mentions: number | null; trend: string | null } | null;
  competitor: { positive_mentions: number | null; negative_mentions: number | null; trend: string | null } | null;
}

function buildThemeRows(
  summaries: { theme: string; owner_type: string; positive_mentions: number | null; negative_mentions: number | null; trend: string | null }[],
): ThemeRow[] {
  const byTheme = new Map<string, ThemeRow>();

  for (const row of summaries) {
    const existing = byTheme.get(row.theme) ?? { theme: row.theme, own: null, competitor: null };
    const cell = { positive_mentions: row.positive_mentions, negative_mentions: row.negative_mentions, trend: row.trend };
    if (row.owner_type === "own") {
      existing.own = cell;
    } else {
      existing.competitor = cell;
    }
    byTheme.set(row.theme, existing);
  }

  return Array.from(byTheme.values());
}

export default async function ThemesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", user!.id)
    .maybeSingle();

  // bkz. docs/10-roadmap.md Faz 1.2 madde 3 / bug fix: `competitor_id` dolu
  // satırlar (görev kartı kanıt satırı için eklenen rakip bazlı kırılım)
  // burada hariç tutulur — aksi halde buildThemeRows'un `existing.competitor`
  // ataması (toplama değil) sorgu sırasına göre rastgele TEK bir rakibin
  // sayısını "Competitors (combined)" diye gösterirdi.
  const { data: summaries } = await supabase
    .from("theme_summary")
    .select("theme, owner_type, positive_mentions, negative_mentions, trend")
    .eq("business_id", business!.id)
    .is("competitor_id", null);

  const t = await getTranslations("business.themes");
  const rows = buildThemeRows(summaries ?? []);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{t("title")}</h1>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <Card key={row.theme}>
              <CardContent className="flex flex-col gap-2">
                <p className="font-medium">{row.theme}</p>
                <div className="grid grid-cols-2 gap-3">
                  <ThemeCell label={t("own")} data={row.own} t={t} />
                  <ThemeCell label={t("competitorsCombined")} data={row.competitor} t={t} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
