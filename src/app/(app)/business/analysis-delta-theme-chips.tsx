import { Badge } from "@/components/ui/badge";

type DeltaTranslator = (key: string, values?: Record<string, string | number>) => string;

// Üç ayrı satır: kötüleşen / iyileşen / kritik own temalar (bkz.
// src/lib/analysis/analysis-delta.ts — her biri en fazla 5 tema). Boş listeler
// hiç render edilmez ki kart gereksiz yere büyümesin.
function ThemeChipRow({
  title,
  themes,
  variant,
}: {
  title: string;
  themes: string[];
  variant: "secondary" | "destructive";
}) {
  if (themes.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{title}</span>
      <div className="flex flex-wrap gap-1">
        {themes.map((theme) => (
          <Badge key={theme} variant={variant}>
            {theme}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export function AnalysisDeltaThemeChips({
  t,
  themesWorsening,
  themesImproving,
  themesCritical,
}: {
  t: DeltaTranslator;
  themesWorsening: string[];
  themesImproving: string[];
  themesCritical: string[];
}) {
  if (themesWorsening.length === 0 && themesImproving.length === 0 && themesCritical.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <ThemeChipRow title={t("worseningThemesTitle")} themes={themesWorsening} variant="destructive" />
      <ThemeChipRow title={t("improvingThemesTitle")} themes={themesImproving} variant="secondary" />
      <ThemeChipRow title={t("criticalThemesTitle")} themes={themesCritical} variant="destructive" />
    </div>
  );
}
