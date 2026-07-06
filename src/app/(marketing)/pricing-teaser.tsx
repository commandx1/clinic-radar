import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FREE_PLAN_PRICE_USD, PRO_PLAN_PRICE_USD } from "@/lib/marketing/pricing-plans";

export async function PricingTeaser() {
  const t = await getTranslations("marketing");

  return (
    <section className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <div className="mb-12 flex flex-col gap-2">
        <span className="text-sm font-medium text-primary">{t("pricingTeaser.eyebrow")}</span>
        <h2 className="font-heading text-3xl font-semibold">{t("pricingTeaser.title")}</h2>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">{t("pricing.free.name")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-3xl font-semibold">${FREE_PLAN_PRICE_USD}</p>
          </CardContent>
        </Card>
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-xl">{t("pricing.pro.name")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-3xl font-semibold">
              ${PRO_PLAN_PRICE_USD}
              <span className="text-base font-normal text-muted-foreground">{t("pricing.perMonth")}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <Button
        variant="outline"
        className="mt-6"
        nativeButton={false}
        render={<Link href="/pricing">{t("pricingTeaser.viewFullPricing")}</Link>}
      />
    </section>
  );
}
