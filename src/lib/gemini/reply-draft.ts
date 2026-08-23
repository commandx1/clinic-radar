import {
  buildReplyDraftSystemPrompt,
  buildReplyDraftUserPrompt,
  replyDraftOutputSchema,
  type ReplyDraftInput,
  type ReplyDraftOutput,
} from "@/lib/ai-pipeline/reply-draft-schema";
import { GEMINI_MODEL, getGeminiClient } from "@/lib/gemini/client";
import { toGeminiJsonSchema } from "@/lib/gemini/json-schema";

export type { ReplyDraftInput, ReplyDraftOutput } from "@/lib/ai-pipeline/reply-draft-schema";

// Şema uyuşmazlığında null döner, SDK/ağ hatalarında fırlatır — Claude
// tarafındaki generateReplyDraft ile birebir aynı kontrat.
export async function generateReplyDraft(input: ReplyDraftInput): Promise<ReplyDraftOutput | null> {
  const client = getGeminiClient();

  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: buildReplyDraftUserPrompt(input),
    config: {
      systemInstruction: buildReplyDraftSystemPrompt(),
      responseMimeType: "application/json",
      responseJsonSchema: toGeminiJsonSchema(replyDraftOutputSchema),
    },
  });

  if (!response.text) {
    return null;
  }

  const parsed: unknown = JSON.parse(response.text);
  const result = replyDraftOutputSchema.safeParse(parsed);
  return result.success ? result.data : null;
}
