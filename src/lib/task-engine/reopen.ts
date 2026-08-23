import { TASK_MENTION_THRESHOLD, DISMISSED_REOPEN_NEGATIVE_MULTIPLIER } from "@/lib/constants";
import { normalizeTheme } from "@/lib/task-engine/theme-similarity";

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

// bkz. docs/02-business-rules.md Bölüm E — bu kontrol BİLİNÇLİ OLARAK sadece
// tam (normalize edilmiş) eşleşme kullanır, theme-similarity.ts'teki fuzzy
// güvenlik ağını KULLANMAZ (trend/reopen semantiği Faz 2.8'de bilinçli olarak
// değiştirilmedi) — reopen tetikleyicisi zaten dar bir eşik (2x negatif
// patlama + TASK_MENTION_THRESHOLD) üzerine kurulu, buraya fuzzy eşleştirme
// eklemek yanlış temayı yeniden açma riskini artırır.
export { normalizeTheme };

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
