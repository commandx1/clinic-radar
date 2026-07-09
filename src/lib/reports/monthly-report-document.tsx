import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { MonthlyReportData, MonthlyReportThemeRow } from "./monthly-report-data";
import "./pdf-fonts";

// `messages/*.json`'daki `business.monthlyReport` bölümüyle senkron tutulmalı.
// react-pdf bileşenleri next-intl'in React context'i üzerinden çalışmaz (kendi
// reconciler'ı, `renderToBuffer` ile imperatif render edilir) — bu yüzden
// weekly-digest.ts'teki desenle aynı şekilde çağıran tarafta hazırlanmış düz
// bir string sözlüğü olarak enjekte edilir.
export interface MonthlyReportStrings {
  title: string;
  generatedOn: (date: string) => string;
  period: (start: string, end: string) => string;
  clinicScore: string;
  scoreDelta: (sign: string, value: string) => string;
  competitorRank: string;
  competitorRankValue: (rank: string, total: string) => string;
  criticalIssues: string;
  completedTasks: string;
  potentialRatingGain: string;
  executiveSummaryTitle: string;
  topPositiveThemesTitle: string;
  topNegativeThemesTitle: string;
  noThemes: string;
  positiveMentions: (count: number) => string;
  negativeMentions: (count: number) => string;
  footer: string;
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11, fontFamily: "Noto Sans", color: "#1a1a1a" },
  title: { fontSize: 20, fontWeight: 700, marginBottom: 2 },
  subtitle: { fontSize: 10, color: "#555555", marginBottom: 1 },
  section: { marginTop: 18 },
  sectionTitle: { fontSize: 13, fontWeight: 700, marginBottom: 6 },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statBox: {
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 4,
    padding: 8,
    minWidth: 120,
    marginBottom: 8,
  },
  statLabel: { fontSize: 9, color: "#666666", marginBottom: 3 },
  statValue: { fontSize: 15, fontWeight: 700 },
  paragraph: { fontSize: 10, lineHeight: 1.5 },
  themeRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  themeName: { fontSize: 10, fontWeight: 700 },
  themeCount: { fontSize: 10, color: "#444444" },
  footer: { position: "absolute", bottom: 24, left: 32, right: 32, fontSize: 8, color: "#999999", textAlign: "center" },
});

function formatDate(iso: string, locale: "tr" | "en"): string {
  return new Date(iso).toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });
}

function ThemeList({ rows, emptyLabel, formatCount }: {
  rows: MonthlyReportThemeRow[];
  emptyLabel: string;
  formatCount: (row: MonthlyReportThemeRow) => string;
}) {
  if (rows.length === 0) {
    return <Text style={styles.paragraph}>{emptyLabel}</Text>;
  }
  return (
    <View>
      {rows.map((row) => (
        <View key={row.theme} style={styles.themeRow}>
          <Text style={styles.themeName}>{row.theme}</Text>
          <Text style={styles.themeCount}>{formatCount(row)}</Text>
        </View>
      ))}
    </View>
  );
}

export function MonthlyReportDocument({ data, strings, locale = "en" }: { data: MonthlyReportData; strings: MonthlyReportStrings; locale?: "tr" | "en" }) {
  const scoreDeltaText =
    data.scoreDeltaSincePeriodStart !== null
      ? strings.scoreDelta(
          data.scoreDeltaSincePeriodStart >= 0 ? "+" : "",
          data.scoreDeltaSincePeriodStart.toFixed(0),
        )
      : null;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{data.businessName}</Text>
        <Text style={styles.subtitle}>{strings.title}</Text>
        <Text style={styles.subtitle}>{strings.generatedOn(formatDate(data.generatedAt, locale))}</Text>
        <Text style={styles.subtitle}>{strings.period(formatDate(data.periodStart, locale), formatDate(data.periodEnd, locale))}</Text>

        <View style={[styles.section, styles.statsRow]}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{strings.clinicScore}</Text>
            <Text style={styles.statValue}>{data.score ?? "-"}</Text>
            {scoreDeltaText && <Text style={styles.statLabel}>{scoreDeltaText}</Text>}
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{strings.competitorRank}</Text>
            <Text style={styles.statValue}>
              {data.competitorRank !== null
                ? strings.competitorRankValue(String(data.competitorRank), String(data.competitorTotal))
                : "-"}
            </Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{strings.criticalIssues}</Text>
            <Text style={styles.statValue}>{data.criticalIssuesCount}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{strings.completedTasks}</Text>
            <Text style={styles.statValue}>{data.completedTasksInPeriod}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>{strings.potentialRatingGain}</Text>
            <Text style={styles.statValue}>+{data.potentialRatingGain.toFixed(1)}</Text>
          </View>
        </View>

        {data.executiveSummary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{strings.executiveSummaryTitle}</Text>
            <Text style={styles.paragraph}>{data.executiveSummary}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{strings.topPositiveThemesTitle}</Text>
          <ThemeList
            rows={data.topPositiveThemes}
            emptyLabel={strings.noThemes}
            formatCount={(row) => strings.positiveMentions(row.positiveMentions)}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{strings.topNegativeThemesTitle}</Text>
          <ThemeList
            rows={data.topNegativeThemes}
            emptyLabel={strings.noThemes}
            formatCount={(row) => strings.negativeMentions(row.negativeMentions)}
          />
        </View>

        <Text style={styles.footer} fixed>
          {strings.footer}
        </Text>
      </Page>
    </Document>
  );
}
