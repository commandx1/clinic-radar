"use client";

import { useTranslations } from "next-intl";
import { CartesianGrid, Line, LineChart, XAxis } from "recharts";

import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

export interface TrendPoint {
  snapshotAt: string;
  score: number | null;
  competitorRank: number | null;
}

const chartConfig = {
  score: { label: "Clinic Score", color: "var(--chart-1)" },
  competitorRank: { label: "Competitor Rank", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function TrendChart({ points }: { points: TrendPoint[] }) {
  const t = useTranslations("business.trend");

  const data = points.map((p) => ({
    date: new Date(p.snapshotAt).toLocaleDateString(),
    score: p.score,
    competitorRank: p.competitorRank,
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
        />
        <Line
          dataKey="competitorRank"
          name={t("competitorRankLabel")}
          type="monotone"
          stroke="var(--color-competitorRank)"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
