import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface ThemeMentionCount {
  theme: string;
  positive_mentions: number;
  negative_mentions: number;
}

export interface SatisfactionOverview {
  totalPositive: number;
  totalNegative: number;
  ratio: number | null;
  topPositive: ThemeMentionCount[];
  topNegative: ThemeMentionCount[];
}

const TOP_THEMES_LIMIT = 3;

export async function loadSatisfactionOverview(
  supabase: SupabaseClient,
  businessId: string,
): Promise<SatisfactionOverview> {
  const { data } = await supabase
    .from("theme_summary")
    .select("theme, positive_mentions, negative_mentions")
    .eq("business_id", businessId)
    .eq("owner_type", "own")
    .is("competitor_id", null);

  const rows: ThemeMentionCount[] = (data ?? []).map((row) => ({
    theme: row.theme,
    positive_mentions: row.positive_mentions,
    negative_mentions: row.negative_mentions,
  }));

  const totalPositive = rows.reduce((sum, row) => sum + row.positive_mentions, 0);
  const totalNegative = rows.reduce((sum, row) => sum + row.negative_mentions, 0);
  const total = totalPositive + totalNegative;

  return {
    totalPositive,
    totalNegative,
    ratio: total > 0 ? totalPositive / total : null,
    topPositive: [...rows]
      .filter((row) => row.positive_mentions > 0)
      .sort((a, b) => b.positive_mentions - a.positive_mentions)
      .slice(0, TOP_THEMES_LIMIT),
    topNegative: [...rows]
      .filter((row) => row.negative_mentions > 0)
      .sort((a, b) => b.negative_mentions - a.negative_mentions)
      .slice(0, TOP_THEMES_LIMIT),
  };
}
