"use client";

import { useTranslations } from "next-intl";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";

import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

export interface TrendPoint {
  snapshotAt: string;
  score: number | null;
  competitorRank: number | null;
  // Faz 2.7 — bkz. src/lib/analysis/recent-ratings.ts, docs/08-dashboard.md
  // Trend. Own canlı puan vs o anki tüm rakiplerin canlı puan MEDYANI (tek
  // bir rakip değil) — ikisi de null olabilir (henüz yeterli yorum yoksa),
  // grafik `connectNulls` ile o noktaları atlar.
  ownRecentRating: number | null;
  competitorMedianRecentRating: number | null;
}

const chartConfig = {
  score: { label: "Clinic Score", color: "var(--chart-1)" },
  competitorRank: { label: "Competitor Rank", color: "var(--chart-2)" },
  ownRecentRating: { label: "Own Recent Rating", color: "var(--chart-3)" },
  competitorMedianRecentRating: { label: "Competitor Median Recent Rating", color: "var(--chart-4)" },
} satisfies ChartConfig;

export function TrendChart({ points }: { points: TrendPoint[] }) {
  const t = useTranslations("business.trend");

  const data = points.map((p) => ({
    date: new Date(p.snapshotAt).toLocaleDateString(),
    score: p.score,
    competitorRank: p.competitorRank,
    ownRecentRating: p.ownRecentRating,
    competitorMedianRecentRating: p.competitorMedianRecentRating,
  }));

  return (
    <ChartContainer config={chartConfig} className="h-[220px] w-full">
      <LineChart data={data}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line
          dataKey="score"
          name={t("clinicScoreLabel")}
          type="monotone"
          stroke="var(--color-score)"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
        <Line
          dataKey="competitorRank"
          name={t("competitorRankLabel")}
          type="monotone"
          stroke="var(--color-competitorRank)"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
        <Line
          dataKey="ownRecentRating"
          name={t("ownRecentRatingLabel")}
          type="monotone"
          stroke="var(--color-ownRecentRating)"
          strokeWidth={2}
          strokeDasharray="4 3"
          dot={false}
          connectNulls
        />
        <Line
          dataKey="competitorMedianRecentRating"
          name={t("competitorMedianRecentRatingLabel")}
          type="monotone"
          stroke="var(--color-competitorMedianRecentRating)"
          strokeWidth={2}
          strokeDasharray="4 3"
          dot={false}
          connectNulls
        />
      </LineChart>
    </ChartContainer>
  );
}
