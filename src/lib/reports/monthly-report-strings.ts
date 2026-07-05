import type { MonthlyReportStrings } from "./monthly-report-document";
import en from "../../../messages/en.json";
import tr from "../../../messages/tr.json";

const templatesByLocale: Record<"tr" | "en", typeof tr> = { tr, en };

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => vars[key] ?? `{${key}}`);
}

export function buildMonthlyReportStrings(locale: "tr" | "en"): MonthlyReportStrings {
  const t = templatesByLocale[locale].business.monthlyReport;
  return {
    title: t.title,
    generatedOn: (date) => fill(t.generatedOn, { date }),
    period: (start, end) => fill(t.period, { start, end }),
    clinicScore: t.clinicScore,
    scoreDelta: (sign, value) => fill(t.scoreDelta, { sign, value }),
    competitorRank: t.competitorRank,
    competitorRankValue: (rank, total) => fill(t.competitorRankValue, { rank, total }),
    criticalIssues: t.criticalIssues,
    completedTasks: t.completedTasks,
    potentialRatingGain: t.potentialRatingGain,
    executiveSummaryTitle: t.executiveSummaryTitle,
    topPositiveThemesTitle: t.topPositiveThemesTitle,
    topNegativeThemesTitle: t.topNegativeThemesTitle,
    noThemes: t.noThemes,
    positiveMentions: (count) => fill(t.positiveMentions, { count: String(count) }),
    negativeMentions: (count) => fill(t.negativeMentions, { count: String(count) }),
    footer: t.footer,
  };
}
