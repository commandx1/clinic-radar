import { getTranslations } from "next-intl/server";

const QUESTIONS = ["q1", "q2", "q3", "q4"] as const;

export async function PricingFaq() {
  const t = await getTranslations("marketing.pricing.faq");

  return (
    <section className="mx-auto max-w-3xl px-6 py-16 sm:py-24">
      <h2 className="font-heading mb-8 text-2xl font-semibold">{t("title")}</h2>
      <dl className="flex flex-col gap-6">
        {QUESTIONS.map((q) => (
          <div key={q} className="flex flex-col gap-1.5">
            <dt className="font-medium">{t(q)}</dt>
            <dd className="text-sm text-muted-foreground">{t(`a${q.slice(1)}`)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
