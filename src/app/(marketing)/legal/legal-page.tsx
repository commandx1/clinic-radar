import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { LEGAL_CONTACT_EMAIL, type LegalDoc, type LegalSection } from "./types";

/** Renders plain legal text, turning the contact email into a mailto link. */
function LegalText({ text }: { text: string }) {
  const parts = text.split(LEGAL_CONTACT_EMAIL);
  if (parts.length === 1) {
    return <>{text}</>;
  }

  return (
    <>
      {parts.map((part, index) => (
        <span key={index}>
          {index > 0 && (
            <a
              href={`mailto:${LEGAL_CONTACT_EMAIL}`}
              className="font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground"
            >
              {LEGAL_CONTACT_EMAIL}
            </a>
          )}
          {part}
        </span>
      ))}
    </>
  );
}

function LegalDocSection({ section, index }: { section: LegalSection; index: number }) {
  return (
    <section id={section.id} className="mt-12 scroll-mt-24">
      <h2 className="font-heading text-xl font-semibold">
        {index + 1}. {section.heading}
      </h2>
      {section.paragraphs?.map((paragraph, pIndex) => (
        <p key={pIndex} className="mt-4 leading-relaxed text-muted-foreground">
          <LegalText text={paragraph} />
        </p>
      ))}
      {section.bullets && (
        <ul className="mt-4 flex flex-col gap-2.5">
          {section.bullets.map((item, bIndex) => (
            <li key={bIndex} className="flex gap-2.5 leading-relaxed text-muted-foreground">
              <span aria-hidden className="mt-[9px] size-1.5 shrink-0 rounded-full bg-border" />
              <span>
                <LegalText text={item} />
              </span>
            </li>
          ))}
        </ul>
      )}
      {section.afterBullets?.map((paragraph, aIndex) => (
        <p key={aIndex} className="mt-4 leading-relaxed text-muted-foreground">
          <LegalText text={paragraph} />
        </p>
      ))}
    </section>
  );
}

export async function LegalPage({ doc }: { doc: LegalDoc }) {
  const t = await getTranslations("marketing.legal");

  const otherDocs = (
    [
      { slug: "privacy", href: "/privacy", label: t("privacyTitle") },
      { slug: "terms", href: "/terms", label: t("termsTitle") },
      { slug: "refund-policy", href: "/refund-policy", label: t("refundTitle") },
    ] as const
  ).filter((item) => item.slug !== doc.slug);

  return (
    <div className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <div className="mb-12 max-w-2xl">
        <p className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {t("eyebrow")}
        </p>
        <h1 className="font-heading text-4xl font-semibold">{doc.title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{doc.lastUpdated}</p>
      </div>

      <div className="flex flex-col gap-12 lg:flex-row lg:gap-16">
        {/* Table of contents */}
        <nav aria-label={t("tocLabel")} className="lg:w-64 lg:shrink-0">
          <div className="lg:sticky lg:top-24">
            <span className="text-sm font-medium text-foreground">{t("tocLabel")}</span>
            <ol className="mt-3 flex flex-col gap-2 border-l border-border pl-4 text-sm">
              {doc.sections.map((section, index) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {index + 1}. {section.heading}
                  </a>
                </li>
              ))}
            </ol>
          </div>
        </nav>

        {/* Document body */}
        <article className="min-w-0 max-w-2xl">
          <div className="flex flex-col gap-4">
            {doc.intro.map((paragraph, index) => (
              <p key={index} className="leading-relaxed text-muted-foreground">
                <LegalText text={paragraph} />
              </p>
            ))}
          </div>

          <aside className="mt-8 rounded-xl border border-border bg-muted/40 p-6">
            <h2 className="font-heading text-base font-semibold">{t("atAGlance")}</h2>
            <ul className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-muted-foreground">
              {doc.atAGlance.map((item, index) => (
                <li key={index} className="flex gap-2.5">
                  <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-primary" />
                  <span>
                    <LegalText text={item} />
                  </span>
                </li>
              ))}
            </ul>
          </aside>

          {doc.sections.map((section, index) => (
            <LegalDocSection key={section.id} section={section} index={index} />
          ))}

          <footer className="mt-16 border-t border-border pt-8">
            <span className="text-sm font-medium text-foreground">{t("otherPolicies")}</span>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {otherDocs.map((item) => (
                <Link
                  key={item.slug}
                  href={item.href}
                  className="text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </footer>
        </article>
      </div>
    </div>
  );
}
