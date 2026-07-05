import { z } from "zod";

// bkz. docs/06-prompts.md Aşama 1 — çıktı şeması. Sağlayıcıdan bağımsız
// (Claude/Gemini) — hem şema hem prompt metni burada tek yerde tutulur, her
// sağlayıcı sadece "modele nasıl sorulur" kısmını implemente eder.
export const themeItemSchema = z.object({
  theme: z.string(),
  sentiment: z.enum(["positive", "negative", "mixed"]),
  mention_count: z.number().int().min(0),
  summary: z.string(),
  // bkz. docs/10-roadmap.md Faz 2 "Treatments" — tema belirli bir tedavi/hizmet
  // türüyle ilişkiliyse (implant, ortodonti, botoks vb.) burada serbest metin
  // olarak belirtilir; kategoriden bağımsız, kapalı bir liste DEĞİL (ürün
  // herhangi bir sağlık/estetik kategorisine açık). Tema genel bir konuyla
  // ilgiliyse (ör. "bekleme süresi") null bırakılır.
  treatment: z.string().nullable(),
});

export const themeExtractionOutputSchema = z.object({
  themes: z.array(themeItemSchema),
});

export type ThemeItem = z.infer<typeof themeItemSchema>;
export type ThemeExtractionOutput = z.infer<typeof themeExtractionOutputSchema>;

export interface ReviewInput {
  rating: number | null;
  text: string;
  language: string | null;
  published_at: string | null;
}

export function buildStage1SystemPrompt(outputLanguage: string): string {
  return (
    "Sen bir müşteri deneyimi analistisin. Sana bir işletmenin Google Maps " +
    "yorumları verilecek. Görevin, yorumlardaki tekrar eden temaları, bu " +
    "temalara dair duygu tonunu ve aciliyetini çıkarmak. Yorumlardan asla " +
    "birebir alıntı yapma, her zaman kendi cümlelerinle özetle. Her tema " +
    "belirli bir tedavi/hizmet türüyle (ör. implant, ortodonti, botoks, dolgu — " +
    "işletmenin kategorisine göre değişir, kapalı bir liste yok) ilgiliyse bunu " +
    "\"treatment\" alanında belirt; tema genel bir konuyla ilgiliyse (ör. bekleme " +
    "süresi, resepsiyon nezaketi, fiyat şeffaflığı) \"treatment\" alanını null " +
    "bırak — bir tedavi türü uydurma. " +
    `"summary" alanlarını "${outputLanguage}" dilinde yaz. Sadece belirtilen ` +
    "JSON şemasında yanıt ver."
  );
}

export function buildStage1UserPrompt(params: {
  businessName: string;
  category: string | null;
  reviews: ReviewInput[];
}): string {
  const reviewList = params.reviews.map((r) => ({
    rating: r.rating,
    text: r.text,
    language: r.language,
    published_at: r.published_at,
  }));

  return [
    `İşletme: ${params.businessName}${params.category ? ` (${params.category})` : ""}`,
    `Yorumlar (son 90 gün, ${String(params.reviews.length)} adet):`,
    JSON.stringify(reviewList),
    "",
    "Her tekrar eden tema için:",
    '- theme: kısa tema adı (ör. "bekleme süresi", "fiyat şeffaflığı")',
    "- sentiment: positive | negative | mixed",
    "- mention_count: bu temaya değinen yorum sayısı",
    "- summary: kendi cümlelerinle 1 cümlelik özet (asla alıntı değil)",
    '- treatment: ilgili tedavi/hizmet türü (ör. "implant", "ortodonti") ya da null',
  ].join("\n");
}
