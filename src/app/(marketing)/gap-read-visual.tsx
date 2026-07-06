import { CheckIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

const ROWS = [
  { key: "theme1", own: 62, competitor: 18 },
  { key: "theme2", own: 71, competitor: 24 },
  { key: "theme3", own: 22, competitor: 15 },
] as const;

export async function GapReadVisual() {
  const t = await getTranslations("marketing.hero.gapRead");

  return (
    <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between text-xs font-medium text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-cta" aria-hidden />
          {t("own")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary" aria-hidden />
          {t("competitor")}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {ROWS.map((row, index) => (
          <div key={row.key} className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{t(row.key)}</span>
            <div className="flex h-2 gap-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full origin-left rounded-full bg-cta motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-1/2"
                style={{
                  width: `${String(row.own)}%`,
                  animationDelay: `${String(index * 150)}ms`,
                  animationDuration: "700ms",
                  animationFillMode: "both",
                }}
              />
              <div
                className="h-full origin-left rounded-full bg-primary motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-1/2"
                style={{
                  width: `${String(row.competitor)}%`,
                  animationDelay: `${String(index * 150 + 100)}ms`,
                  animationDuration: "700ms",
                  animationFillMode: "both",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div
        className="mt-5 flex items-center gap-3 rounded-xl border border-cta/30 bg-cta/10 p-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
        style={{ animationDelay: "650ms", animationDuration: "600ms", animationFillMode: "both" }}
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-cta text-cta-foreground">
          <CheckIcon className="size-3.5" />
        </span>
        <p className="text-sm font-medium text-foreground">{t("resolvedTask")}</p>
      </div>
    </div>
  );
}
