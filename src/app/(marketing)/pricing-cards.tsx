import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PRICING_PLAN_LIMITS, FREE_PLAN_PRICE_USD, PRO_PLAN_PRICE_USD } from "@/lib/marketing/pricing-plans";

export async function PricingCards({ proHref }: { proHref: string }) {
  const t = await getTranslations("marketing.pricing");

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t("free.name")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("free.tagline")}</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <p className="font-heading text-4xl font-semibold">${FREE_PLAN_PRICE_USD}</p>
          <ul className="flex flex-col gap-2 text-sm">
            <PricingFeature>{t("free.feature1")}</PricingFeature>
            <PricingFeature>
              {t("free.feature2", { count: PRICING_PLAN_LIMITS.free.maxCompetitors })}
            </PricingFeature>
            <PricingFeature>{t("free.feature3")}</PricingFeature>
            <PricingFeature>{t("free.feature4")}</PricingFeature>
          </ul>
          <Button variant="outline" nativeButton={false} render={<Link href="/signup">{t("free.cta")}</Link>} />
        </CardContent>
      </Card>

      <Card className="border-primary">
        <CardHeader>
          <CardTitle className="text-xl">{t("pro.name")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("pro.tagline")}</p>
          <CardAction>
            <Badge>{t("pro.badge")}</Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <p className="font-heading text-4xl font-semibold">
            ${PRO_PLAN_PRICE_USD}
            <span className="text-base font-normal text-muted-foreground">{t("perMonth")}</span>
          </p>
          <ul className="flex flex-col gap-2 text-sm">
            <PricingFeature>{t("pro.feature1")}</PricingFeature>
            <PricingFeature>{t("pro.feature2", { count: PRICING_PLAN_LIMITS.pro.maxCompetitors })}</PricingFeature>
            <PricingFeature>{t("pro.feature3")}</PricingFeature>
            <PricingFeature>{t("pro.feature4")}</PricingFeature>
            <PricingFeature>{t("pro.feature5")}</PricingFeature>
            <PricingFeature>{t("pro.feature6")}</PricingFeature>
          </ul>
          <Button variant="cta" nativeButton={false} render={<Link href={proHref}>{t("pro.cta")}</Link>} />
        </CardContent>
      </Card>
    </div>
  );
}

function PricingFeature({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" />
      <span>{children}</span>
    </li>
  );
}
