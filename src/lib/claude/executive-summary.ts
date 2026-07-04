import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import {
  buildStage3SystemPrompt,
  buildStage3UserPrompt,
  executiveSummaryOutputSchema,
  type ExecutiveSummaryInput,
  type ExecutiveSummaryOutput,
} from "@/lib/ai-pipeline/executive-summary-schema";
import { CLAUDE_MODEL, getClaudeClient } from "@/lib/claude/client";

export type { ExecutiveSummaryInput, ExecutiveSummaryOutput } from "@/lib/ai-pipeline/executive-summary-schema";

// Şema uyuşmazlığında null döner, SDK/ağ/auth hatalarında fırlatır — aynı
// kontrat gap-analysis.ts'teki generateGapAnalysis ile birebir aynı.
export async function generateExecutiveSummary(input: ExecutiveSummaryInput): Promise<ExecutiveSummaryOutput | null> {
  const client = getClaudeClient();

  const message = await client.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: buildStage3SystemPrompt(),
    messages: [{ role: "user", content: buildStage3UserPrompt(input) }],
    output_config: { format: zodOutputFormat(executiveSummaryOutputSchema) },
  });

  return message.parsed_output ?? null;
}
