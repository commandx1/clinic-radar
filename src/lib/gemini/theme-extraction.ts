import {
  buildStage1SystemPrompt,
  buildStage1UserPrompt,
  themeExtractionOutputSchema,
  type ReviewInput,
  type ThemeExtractionOutput,
} from "@/lib/ai-pipeline/theme-extraction-schema";
import { GEMINI_MODEL, getGeminiClient } from "@/lib/gemini/client";
import { toGeminiJsonSchema } from "@/lib/gemini/json-schema";

export type { ReviewInput, ThemeExtractionOutput, ThemeItem } from "@/lib/ai-pipeline/theme-extraction-schema";

// Şema uyuşmazlığında null döner, SDK/ağ hatalarında fırlatır — Claude
// tarafındaki extractThemes ile birebir aynı kontrat (bkz. src/lib/claude/theme-extraction.ts).
export async function extractThemes(params: {
  businessName: string;
  category: string | null;
  reviews: ReviewInput[];
  outputLanguage: string;
  windowDays: number;
}): Promise<ThemeExtractionOutput | null> {
  const client = getGeminiClient();

  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: buildStage1UserPrompt(params),
    config: {
      systemInstruction: buildStage1SystemPrompt(params.outputLanguage),
      responseMimeType: "application/json",
      responseJsonSchema: toGeminiJsonSchema(themeExtractionOutputSchema),
    },
  });

  if (!response.text) {
    return null;
  }

  const parsed: unknown = JSON.parse(response.text);
  const result = themeExtractionOutputSchema.safeParse(parsed);
  return result.success ? result.data : null;
}
