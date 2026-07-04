import {
  buildStage3SystemPrompt,
  buildStage3UserPrompt,
  executiveSummaryOutputSchema,
  type ExecutiveSummaryInput,
  type ExecutiveSummaryOutput,
} from "@/lib/ai-pipeline/executive-summary-schema";
import { GEMINI_MODEL, getGeminiClient } from "@/lib/gemini/client";
import { toGeminiJsonSchema } from "@/lib/gemini/json-schema";

export type { ExecutiveSummaryInput, ExecutiveSummaryOutput } from "@/lib/ai-pipeline/executive-summary-schema";

// Şema uyuşmazlığında null döner, SDK/ağ hatalarında fırlatır — Claude
// tarafındaki generateExecutiveSummary ile birebir aynı kontrat.
export async function generateExecutiveSummary(input: ExecutiveSummaryInput): Promise<ExecutiveSummaryOutput | null> {
  const client = getGeminiClient();

  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: buildStage3UserPrompt(input),
    config: {
      systemInstruction: buildStage3SystemPrompt(),
      responseMimeType: "application/json",
      responseJsonSchema: toGeminiJsonSchema(executiveSummaryOutputSchema),
    },
  });

  if (!response.text) {
    return null;
  }

  const parsed: unknown = JSON.parse(response.text);
  const result = executiveSummaryOutputSchema.safeParse(parsed);
  return result.success ? result.data : null;
}
