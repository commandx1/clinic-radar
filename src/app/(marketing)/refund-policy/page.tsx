import type { Metadata } from "next";
import { getLocale } from "next-intl/server";

import { isLocale, defaultLocale } from "@/i18n/locales";

import { LegalPage } from "../legal/legal-page";
import { refundContent } from "../legal/refund-content";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const doc = refundContent[isLocale(locale) ? locale : defaultLocale];
  return { title: doc.metaTitle, description: doc.metaDescription };
}

export default async function RefundPolicyPage() {
  const locale = await getLocale();
  const doc = refundContent[isLocale(locale) ? locale : defaultLocale];
  return <LegalPage doc={doc} />;
}
