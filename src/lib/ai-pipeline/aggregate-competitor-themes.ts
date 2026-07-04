import type { ThemeItem } from "@/lib/ai-pipeline/theme-extraction-schema";
import { normalizeTheme } from "@/lib/task-engine/reopen";

export interface AggregatedTheme {
  theme: string;
  positive_mentions: number;
  negative_mentions: number;
}

// theme_summary'nin owner_type='competitor' satırları TÜM seçili rakiplerin
// TOPLU'sudur (tabloda rakip kimliğini tutan bir kolon yok — bkz.
// docs/03-database.md). Bu fonksiyon N rakibin Aşama 1 çıktısını normalize
// edilmiş (trim+lowercase) tema adına göre toplar — fuzzy/embedding eşleştirme
// yok, src/lib/category/normalize.ts'teki Faz 1 sınırlamasıyla aynı kabul
// edilen yaklaşım.
export function aggregateCompetitorThemes(
  perCompetitor: { competitorId: string; themes: ThemeItem[] }[],
): AggregatedTheme[] {
  const byNormalizedTheme = new Map<string, { label: string; positive: number; negative: number }>();

  for (const competitor of perCompetitor) {
    for (const item of competitor.themes) {
      const key = normalizeTheme(item.theme);
      const entry = byNormalizedTheme.get(key) ?? { label: item.theme, positive: 0, negative: 0 };

      if (item.sentiment === "positive") {
        entry.positive += item.mention_count;
      } else if (item.sentiment === "negative") {
        entry.negative += item.mention_count;
      } else {
        // mixed: negatife hafif yuvarlama (ceil) — "gerçek sorunları kaçırma"
        // ruhuna daha uygun, keyfi bir tie-break (bkz. plan notu).
        entry.positive += Math.floor(item.mention_count / 2);
        entry.negative += Math.ceil(item.mention_count / 2);
      }

      byNormalizedTheme.set(key, entry);
    }
  }

  return Array.from(byNormalizedTheme.values()).map((entry) => ({
    theme: entry.label,
    positive_mentions: entry.positive,
    negative_mentions: entry.negative,
  }));
}
