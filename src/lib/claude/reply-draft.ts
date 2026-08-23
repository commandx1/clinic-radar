import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import {
  buildReplyDraftSystemPrompt,
  buildReplyDraftUserPrompt,
  replyDraftOutputSchema,
  type ReplyDraftInput,
  type ReplyDraftOutput,
} from "@/lib/ai-pipeline/reply-draft-schema";
import { CLAUDE_MODEL, getClaudeClient } from "@/lib/claude/client";

export type { ReplyDraftInput, ReplyDraftOutput } from "@/lib/ai-pipeline/reply-draft-schema";

// Şema uyuşmazlığında null döner, SDK/ağ/auth hatalarında fırlatır — aynı
// kontrat generateExecutiveSummary ile birebir aynı.
export async function generateReplyDraft(input: ReplyDraftInput): Promise<ReplyDraftOutput | null> {
  const client = getClaudeClient();

  const message = await client.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 2048,
    system: buildReplyDraftSystemPrompt(),
    messages: [{ role: "user", content: buildReplyDraftUserPrompt(input) }],
    output_config: { format: zodOutputFormat(replyDraftOutputSchema) },
  });

  return message.parsed_output ?? null;
}
