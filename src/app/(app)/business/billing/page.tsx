import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

import { CheckoutLinkButton } from "./checkout-button";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout_error?: string }>;
}) {
  const params = await searchParams;
  const checkoutFailed = params.checkout_error === "1";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("plan, status, current_period_end, lemonsqueezy_customer_portal_url")
    .eq("user_id", user!.id)
    .maybeSingle();

  const t = await getTranslations("business.billing");
  const plan = subscription?.plan ?? "free";
  const isPro = plan === "pro";

  return (
    <div className="flex max-w-md flex-col gap-4">
      {checkoutFailed && (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-col gap-1">
            <p className="text-sm font-medium text-destructive">{t("checkoutError.title")}</p>
            <p className="text-sm text-destructive/80">{t("checkoutError.description")}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {t("currentPlan")}
            <Badge variant={isPro ? "default" : "outline"}>{t(`plan.${plan}`)}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {isPro && subscription?.current_period_end && (
            <p className="text-sm text-muted-foreground">
              {t("renewsOn", {
                date: new Date(subscription.current_period_end).toLocaleDateString(),
              })}
            </p>
          )}

          {isPro ? (
            subscription?.lemonsqueezy_customer_portal_url && (
              <CheckoutLinkButton href={subscription.lemonsqueezy_customer_portal_url} label={t("manageBilling")} />
            )
          ) : (
            <CheckoutLinkButton href="/api/billing/checkout" label={t("upgradeToPro")} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
