import {
  buildStage2SystemPrompt,
  buildStage2UserPrompt,
  buildTaskCandidateSchema,
  type CompetitorThemeInput,
  type GapAnalysisOutput,
} from "@/lib/ai-pipeline/gap-analysis-schema";
import type { ThemeItem } from "@/lib/ai-pipeline/theme-extraction-schema";
import { GEMINI_MODEL, getGeminiClient } from "@/lib/gemini/client";
import { toGeminiJsonSchema } from "@/lib/gemini/json-schema";

export type { CompetitorThemeInput, GapAnalysisOutput, TaskCandidate } from "@/lib/ai-pipeline/gap-analysis-schema";

// Şema uyuşmazlığında null döner, SDK/ağ hatalarında fırlatır — Claude
// tarafındaki generateGapAnalysis ile birebir aynı kontrat.
export async function generateGapAnalysis(params: {
  ownThemes: ThemeItem[];
  competitors: CompetitorThemeInput[];
}): Promise<GapAnalysisOutput | null> {
  const client = getGeminiClient();
  const competitorIds = params.competitors.map((c) => c.id);
  const schema = buildTaskCandidateSchema(competitorIds);

  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: buildStage2UserPrompt(params),
    config: {
      systemInstruction: buildStage2SystemPrompt(params.competitors.length > 0),
      responseMimeType: "application/json",
      responseJsonSchema: toGeminiJsonSchema(schema),
    },
  });

  if (!response.text) {
    return null;
  }

  const parsed: unknown = JSON.parse(response.text);
  const result = schema.safeParse(parsed);
  return result.success ? result.data : null;
}
