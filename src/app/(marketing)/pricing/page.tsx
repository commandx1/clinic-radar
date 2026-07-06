import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";

import { PricingCards } from "../pricing-cards";
import { PricingFaq } from "../pricing-faq";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing.meta");
  return {
    title: t("pricingTitle"),
    description: t("pricingDescription"),
  };
}

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const t = await getTranslations("marketing.pricing");
  const proHref = user ? "/api/billing/checkout" : "/signup";

  return (
    <>
      <div className="mx-auto max-w-6xl px-6 pt-16 sm:pt-24">
        <div className="mb-12 flex flex-col items-center gap-3 text-center">
          <h1 className="font-heading text-4xl font-semibold">{t("title")}</h1>
          <p className="max-w-xl text-lg text-muted-foreground">{t("subtitle")}</p>
        </div>

        <PricingCards proHref={proHref} />
      </div>
      <PricingFaq />
    </>
  );
}
