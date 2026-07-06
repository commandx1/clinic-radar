import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { createClient } from "@/lib/supabase/server";

import { CtaBand } from "./cta-band";
import { FeatureGrid } from "./feature-grid";
import { Hero } from "./hero";
import { HowItWorks } from "./how-it-works";
import { PricingTeaser } from "./pricing-teaser";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("marketing.meta");
  const tMetadata = await getTranslations("metadata");
  return {
    title: tMetadata("title"),
    description: t("landingDescription"),
  };
}

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/business");
  }

  return (
    <>
      <Hero />
      <HowItWorks />
      <FeatureGrid />
      <PricingTeaser />
      <CtaBand />
    </>
  );
}
