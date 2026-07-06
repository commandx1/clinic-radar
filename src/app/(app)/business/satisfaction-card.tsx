import type { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

import { SatisfactionChart } from "./satisfaction-chart";
import type { SatisfactionOverview, ThemeMentionCount } from "./satisfaction-overview";

type SatisfactionTranslator = Awaited<ReturnType<typeof getTranslations<"business.satisfaction">>>;

function ThemeList({ title, themes, variant }: { title: string; themes: ThemeMentionCount[]; variant: "secondary" | "destructive" }) {
  if (themes.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{title}</span>
      <div className="flex flex-wrap gap-1">
        {themes.map((theme) => (
          <Badge key={theme.theme} variant={variant}>
            {theme.theme}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export function SatisfactionCard({
  t,
  overview,
  compact = false,
}: {
  t: SatisfactionTranslator;
  overview: SatisfactionOverview;
  compact?: boolean;
}) {
  if (overview.ratio === null) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("noData")}</p>
        </CardContent>
      </Card>
    );
  }

  const ratioPercent = Math.round(overview.ratio * 100);

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col items-center gap-2 sm:items-start">
          <p className="text-sm text-muted-foreground">{t("title")}</p>
          <p className="text-3xl font-semibold">{t("ratioLabel", { value: ratioPercent })}</p>
          <div className="flex gap-2">
            <Badge variant="secondary">{t("positiveCount", { count: overview.totalPositive })}</Badge>
            <Badge variant="destructive">{t("negativeCount", { count: overview.totalNegative })}</Badge>
          </div>
        </div>
        <SatisfactionChart totalPositive={overview.totalPositive} totalNegative={overview.totalNegative} />
      </CardContent>

      {!compact && (overview.topPositive.length > 0 || overview.topNegative.length > 0) && (
        <CardContent className="grid grid-cols-1 gap-3 border-t pt-4 sm:grid-cols-2">
          <ThemeList title={t("topPositiveTitle")} themes={overview.topPositive} variant="secondary" />
          <ThemeList title={t("topNegativeTitle")} themes={overview.topNegative} variant="destructive" />
        </CardContent>
      )}
    </Card>
  );
}
