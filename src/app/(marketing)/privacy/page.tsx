import type { Metadata } from "next";
import { getLocale } from "next-intl/server";

import { isLocale, defaultLocale } from "@/i18n/locales";

import { LegalPage } from "../legal/legal-page";
import { privacyContent } from "../legal/privacy-content";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const doc = privacyContent[isLocale(locale) ? locale : defaultLocale];
  return { title: doc.metaTitle, description: doc.metaDescription };
}

export default async function PrivacyPage() {
  const locale = await getLocale();
  const doc = privacyContent[isLocale(locale) ? locale : defaultLocale];
  return <LegalPage doc={doc} />;
}
