import { TASK_MENTION_THRESHOLD, DISMISSED_REOPEN_NEGATIVE_MULTIPLIER } from "@/lib/constants";

// `fetchPreviousThemeCounts` (src/app/api/business/[id]/analysis/run/route.ts)
// çıktısıyla uyumlu minimal tipler — dosya arası I/O bağımlılığı olmasın diye
// burada tekrar tanımlanır (reopen.ts saf/test edilebilir kalmalı).
export interface PreviousMentionCounts {
  positive_mentions: number;
  negative_mentions: number;
}

export interface OwnThemeAggregate {
  theme: string;
  negative_mentions: number;
}

export function normalizeTheme(theme: string): string {
  return theme.trim().toLowerCase();
}

// bkz. docs/02-business-rules.md Bölüm E: `dismissed` bir görev, aynı temada
// (kendi/own taraf) negatif mention sayısı bir önceki döngüye göre en az 2x
// artarsa (`DISMISSED_REOPEN_NEGATIVE_MULTIPLIER`) yeniden `open` olarak
// türetilir. Gürültüyü elemek için yeni negatif mention sayısı ayrıca Bölüm
// D'deki görev oluşturma eşiğini (`TASK_MENTION_THRESHOLD`) de geçmeli — ör.
// 1 → 2 mention artışı 2x olsa da eşik altında kaldığı için tetiklemez.
export function selectThemesToReopen(
  prevCounts: Map<string, PreviousMentionCounts>,
  ownThemes: OwnThemeAggregate[],
): string[] {
  const themesToReopen: string[] = [];

  for (const theme of ownThemes) {
    const key = `own|${normalizeTheme(theme.theme)}`;
    const prev = prevCounts.get(key);

    if (!prev || prev.negative_mentions < 1) {
      continue;
    }
    if (theme.negative_mentions < TASK_MENTION_THRESHOLD) {
      continue;
    }
    if (theme.negative_mentions < prev.negative_mentions * DISMISSED_REOPEN_NEGATIVE_MULTIPLIER) {
      continue;
    }

    themesToReopen.push(theme.theme);
  }

  return themesToReopen;
}
