import { getTranslations } from "next-intl/server";

import { Card, CardContent } from "@/components/ui/card";

import { BusinessEditForm } from "./business-edit-form";
import type { EditableBusiness } from "./use-business-edit-form";

// Enrichment başarısız (lat/lng null) kalan kullanıcı eskiden burada sadece
// statik bir mesaj görüp sıkışıyordu (düzeltme yolu yoktu). Artık aynı kartta
// düzenlenebilir bir form var: Place ID'yi düzeltip kaydedince PATCH route'u
// yeniden Apify enrichment tetikler ve başarılıysa kullanıcı akışa devam eder.
export async function EnrichmentFailedNotice({ business }: { business: EditableBusiness }) {
  const t = await getTranslations("business.enrichmentFailed");

  return (
    <Card className="max-w-md">
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <p className="font-medium">{t("title")}</p>
          <p className="text-sm text-muted-foreground">{t("body")}</p>
        </div>
        <BusinessEditForm business={business} />
      </CardContent>
    </Card>
  );
}
