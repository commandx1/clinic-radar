import { z } from "zod";

import { bilingualTextSchema } from "@/lib/ai-pipeline/gap-analysis-schema";

// bkz. docs/06-prompts.md Aşama 3 — çıktı şeması. Sağlayıcıdan bağımsız.

export const executiveSummaryOutputSchema = z.object({ summary: bilingualTextSchema });

export type ExecutiveSummaryOutput = z.infer<typeof executiveSummaryOutputSchema>;

export interface ThemeTrendInput {
  theme: string;
  trend: "improving" | "worsening" | "stable" | null;
  positive_mentions: number;
  negative_mentions: number;
  // bkz. docs/10-roadmap.md Faz 1.2 madde 3 — dolu ise bu satır tek bir rakibe
  // özeldir (görev kartı kanıt satırı için), null ise own ya da toplulaştırılmış
  // rakip satırıdır (skorlama/Themes sayfası/bildirimler bunu okur, davranış aynı).
  competitor_id?: string | null;
  // bkz. docs/10-roadmap.md Faz 2 "Treatments" — tema belirli bir tedavi/hizmet
  // türüyle ilişkiliyse dolu, genel bir tema ise null (bkz. theme-extraction-schema.ts).
  treatment?: string | null;
}

export interface ExecutiveSummaryInput {
  score: number;
  prevScore: number | null;
  doneCount: number;
  totalCount: number;
  themeTrends: ThemeTrendInput[];
}

export function buildStage3SystemPrompt(): string {
  return (
    "Sen bir işletme analistisin. Sana bir kliniğin skor, görev ve tema trend " +
    "verileri verilecek. 2-3 cümlelik, tek paragraflık bir yönetici özeti yaz; " +
    "en az bir somut sayı veya trend referans ver. Yorumlardan asla birebir " +
    "alıntı yapma. Önceki skor verilmediyse (ilk analiz) geçmiş bir değer " +
    'uydurma. "summary" alanını hem "tr" hem "en" anahtarıyla, iki dilde de yaz ' +
    '(ör. {"tr": "...", "en": "..."}). Sadece belirtilen JSON şemasında yanıt ver.'
  );
}

export function buildStage3UserPrompt(input: ExecutiveSummaryInput): string {
  const prevScoreLabel =
    input.prevScore === null ? "ilk analiz" : `geçen ay: ${String(input.prevScore)}`;

  return [
    `Clinic Score: ${String(input.score)} (${prevScoreLabel})`,
    `Tamamlanan görevler: ${String(input.doneCount)}/${String(input.totalCount)}`,
    `Tema trendleri: ${JSON.stringify(input.themeTrends)}`,
    "",
    "Tek paragraf, 2-3 cümlelik bir yönetici özeti yaz. Somut bir sayı veya trend referans ver.",
  ].join("\n");
}
