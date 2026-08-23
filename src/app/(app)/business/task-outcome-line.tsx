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
// (latest) arasındaki kıyas. `outcome` undefined ise (baseline/latest eksik,
// henüz ikinci bir ölçüm yapılmamış, ya da `compareOutcome` null döndüyse —
// bkz. resolve-tasks-shared.ts computeOutcome — competitive_gap'te own hiç
// mention almadıysa ya da absolute_quality'de own analiz bu döngüde hiçbir
// şey ölçmediyse gösterilecek anlamlı bir şey yok demektir) satır hiç render
// edilmez.
export function TaskOutcomeLine({ outcome }: { outcome?: TaskOutcomeData }) {
  const t = useTranslations("business.tasks.outcome");

  if (!outcome) {
    return null;
  }

  const { baseline, latest, verdict } = outcome;
  let text: string;

  if (baseline.kind === "theme" && latest.kind === "theme") {
    if (latest.source_type === "competitive_gap") {
      // bkz. docs/09-task-engine.md — competitive_gap görevi TANIM GEREĞİ own
      // tarafında zaten "absent"/sessiz başlar (rakip güçlü, klinik konuşmuyor);
      // negatif oran burada göstermeye değer bir sinyal değil, own OLUMLU
      // mention'ların başlaması/artmasıdır.
      text = t("competitiveGap", { baseline: baseline.positive, latest: latest.positive });
    } else if (latest.absent) {
      text = t("themeAbsent", { baseline: pct(baseline.negative_ratio) });
    } else {
      text = t("theme", { baseline: pct(baseline.negative_ratio), latest: pct(latest.negative_ratio) });
    }
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
