"use client";

import { useTranslations } from "next-intl";
import { Pie, PieChart } from "recharts";

import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const chartConfig = {
  positive: { label: "Positive", color: "var(--chart-1)" },
  negative: { label: "Negative", color: "var(--destructive)" },
} satisfies ChartConfig;

export function SatisfactionChart({ totalPositive, totalNegative }: { totalPositive: number; totalNegative: number }) {
  const t = useTranslations("business.satisfaction");

  const data = [
    { key: "positive", name: t("positiveLabel"), value: totalPositive, fill: "var(--color-positive)" },
    { key: "negative", name: t("negativeLabel"), value: totalNegative, fill: "var(--color-negative)" },
  ];

  return (
    <ChartContainer config={chartConfig} className="mx-auto aspect-square h-[160px]">
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} strokeWidth={2} />
      </PieChart>
    </ChartContainer>
  );
}
