import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import {
  buildStage1SystemPrompt,
  buildStage1UserPrompt,
  themeExtractionOutputSchema,
  type ReviewInput,
  type ThemeExtractionOutput,
} from "@/lib/ai-pipeline/theme-extraction-schema";
import { CLAUDE_MODEL, getClaudeClient } from "@/lib/claude/client";

export type { ReviewInput, ThemeExtractionOutput, ThemeItem } from "@/lib/ai-pipeline/theme-extraction-schema";

// Şema uyuşmazlığında null döner (retry-then-skip mantığı bunu kullanır);
// SDK/ağ/auth hatalarında fırlatır — çağıran taraf ikisini ayrı ele alır.
export async function extractThemes(params: {
  businessName: string;
  category: string | null;
  reviews: ReviewInput[];
  outputLanguage: string;
}): Promise<ThemeExtractionOutput | null> {
  const client = getClaudeClient();

  const message = await client.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system: buildStage1SystemPrompt(params.outputLanguage),
    messages: [{ role: "user", content: buildStage1UserPrompt(params) }],
    output_config: { format: zodOutputFormat(themeExtractionOutputSchema) },
  });

  return message.parsed_output ?? null;
}
