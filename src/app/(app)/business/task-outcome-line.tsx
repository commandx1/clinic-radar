import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import type { OutcomeVerdict } from "@/lib/task-engine/task-outcome";

import type { TaskOutcomeData } from "./task-card-body";

const VERDICT_BADGE_VARIANT: Record<OutcomeVerdict, "default" | "destructive" | "outline"> = {
  improved: "default",
  worsened: "destructive",
  flat: "outline",
};

function pct(ratio: number): number {
  return Math.round(ratio * 100);
}

// bkz. docs/09-task-engine.md "Görev sonuç takibi" — ürünün "işe yaradı mı?"
// kanıtı: görev oluşturulduğundaki ölçüm (baseline) ile en güncel ölçüm
// (latest) arasındaki kıyas. `outcome` undefined ise (baseline/latest eksik ya
// da henüz ikinci bir ölçüm yapılmamış — bkz. resolve-tasks-shared.ts
// computeOutcome) satır hiç render edilmez.
export function TaskOutcomeLine({ outcome }: { outcome?: TaskOutcomeData }) {
  const t = useTranslations("business.tasks.outcome");

  if (!outcome) {
    return null;
  }

  const { baseline, latest, verdict } = outcome;
  let text: string;

  if (baseline.kind === "theme" && latest.kind === "theme") {
    text = latest.absent
      ? t("themeAbsent", { baseline: pct(baseline.negative_ratio) })
      : t("theme", { baseline: pct(baseline.negative_ratio), latest: pct(latest.negative_ratio) });
  } else if (baseline.kind === "reply_rate" && latest.kind === "reply_rate") {
    text = t("replyRate", { baseline: pct(baseline.rate), latest: pct(latest.rate) });
  } else if (baseline.kind === "website" && latest.kind === "website") {
    // Bu görev sadece own website yokken üretilir (bkz. profile-gap-candidates.ts
    // buildWebsiteCandidate), yani baseline pratikte hep `has_website: false`
    // olur — "eklendi" metni yalnızca gerçekten eklendiğinde anlamlı, aksi
    // halde (hâlâ yoksa) satır gösterilmez.
    if (!latest.has_website) {
      return null;
    }
    text = t("website");
  } else {
    return null;
  }

  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Badge variant={VERDICT_BADGE_VARIANT[verdict]} className="text-[10px]">
        {t(`verdict.${verdict}`)}
      </Badge>
      {text}
    </p>
  );
}
