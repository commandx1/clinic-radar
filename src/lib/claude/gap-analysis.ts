import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import {
  buildStage2SystemPrompt,
  buildStage2UserPrompt,
  buildTaskCandidateSchema,
  type CompetitorThemeInput,
  type GapAnalysisOutput,
} from "@/lib/ai-pipeline/gap-analysis-schema";
import type { ThemeItem } from "@/lib/ai-pipeline/theme-extraction-schema";
import { CLAUDE_MODEL, getClaudeClient } from "@/lib/claude/client";

export type { CompetitorThemeInput, GapAnalysisOutput, TaskCandidate } from "@/lib/ai-pipeline/gap-analysis-schema";

// Şema uyuşmazlığında null döner, SDK/ağ/auth hatalarında fırlatır — aynı
// kontrat theme-extraction.ts'teki extractThemes ile birebir aynı.
export async function generateGapAnalysis(params: {
  ownThemes: ThemeItem[];
  competitors: CompetitorThemeInput[];
}): Promise<GapAnalysisOutput | null> {
  const client = getClaudeClient();
  const competitorIds = params.competitors.map((c) => c.id);

  const message = await client.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    system: buildStage2SystemPrompt(params.competitors.length > 0),
    messages: [{ role: "user", content: buildStage2UserPrompt(params) }],
    output_config: { format: zodOutputFormat(buildTaskCandidateSchema(competitorIds)) },
  });

  return message.parsed_output ?? null;
}
