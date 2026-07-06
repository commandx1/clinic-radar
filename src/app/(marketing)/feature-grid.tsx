import { ListChecksIcon, MessageSquareTextIcon, FileTextIcon, RadarIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Card, CardContent } from "@/components/ui/card";

const FEATURES = [
  { key: "taskEngine", Icon: ListChecksIcon },
  { key: "themeAnalysis", Icon: MessageSquareTextIcon },
  { key: "weeklyRescan", Icon: RadarIcon },
  { key: "monthlyReport", Icon: FileTextIcon },
] as const;

export async function FeatureGrid() {
  const t = await getTranslations("marketing.features");

  return (
    <section id="features" className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <div className="mb-12 flex flex-col gap-2">
        <span className="text-sm font-medium text-primary">{t("eyebrow")}</span>
        <h2 className="font-heading text-3xl font-semibold">{t("title")}</h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ key, Icon }) => (
          <Card key={key}>
            <CardContent className="flex flex-col gap-3">
              <Icon className="size-6 text-primary" />
              <h3 className="font-medium">{t(`${key}.title`)}</h3>
              <p className="text-sm text-muted-foreground">{t(`${key}.body`)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
