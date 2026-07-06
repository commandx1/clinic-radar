import { getTranslations } from "next-intl/server";

const STEPS = ["step1", "step2", "step3"] as const;

export async function HowItWorks() {
  const t = await getTranslations("marketing.howItWorks");

  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-16 sm:py-24">
      <div className="mb-12 flex flex-col gap-2">
        <span className="text-sm font-medium text-primary">{t("eyebrow")}</span>
        <h2 className="font-heading text-3xl font-semibold">{t("title")}</h2>
      </div>

      <div className="grid gap-8 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <div key={step} className="flex flex-col gap-3">
            <span className="font-heading text-4xl font-semibold text-primary/40">
              {String(index + 1).padStart(2, "0")}
            </span>
            <h3 className="text-lg font-semibold">{t(`${step}.title`)}</h3>
            <p className="text-muted-foreground">{t(`${step}.body`)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
