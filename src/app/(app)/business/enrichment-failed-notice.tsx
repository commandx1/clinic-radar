import { getTranslations } from "next-intl/server";

import { Card, CardContent } from "@/components/ui/card";

export async function EnrichmentFailedNotice() {
  const t = await getTranslations("business.enrichmentFailed");

  return (
    <Card className="max-w-md">
      <CardContent className="flex flex-col gap-2">
        <p className="font-medium">{t("title")}</p>
        <p className="text-sm text-muted-foreground">{t("body")}</p>
      </CardContent>
    </Card>
  );
}
