import type { Locale } from "@/i18n/locales";

export interface LegalSection {
  /** Anchor id used in the table of contents. */
  id: string;
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
  /** Paragraphs rendered after the bullet list, if any. */
  afterBullets?: string[];
}

export interface LegalDoc {
  slug: "privacy" | "terms" | "refund-policy";
  title: string;
  metaTitle: string;
  metaDescription: string;
  /** Human-readable "last updated" date, already localized. */
  lastUpdated: string;
  intro: string[];
  /** Short plain-language summary shown in a highlighted card. */
  atAGlance: string[];
  sections: LegalSection[];
}

export type LocalizedLegalDoc = Record<Locale, LegalDoc>;

export const LEGAL_CONTACT_EMAIL = "serhatbelen7.developer@gmail.com";
