import { z } from "zod";

// bkz. docs/06-prompts.md "Yorum Yanıt Taslağı" — çıktı şeması. Sağlayıcıdan
// bağımsız (executive-summary-schema.ts ile aynı desen).

export const replyDraftOutputSchema = z.object({ reply: z.string() });

export type ReplyDraftOutput = z.infer<typeof replyDraftOutputSchema>;

export interface ReplyDraftInput {
  businessName: string;
  category: string | null;
  rating: number | null;
  reviewText: string;
  reviewLanguage: string | null;
  tone: "warm" | "formal";
}

// Sistem promptu bilinçli olarak İngilizce yazıldı (bkz. worker brief) — çıktı
// dili parametrik değil, doğrudan yorumun kendi dilinden çıkarılıyor (bu
// promptun tek istisnası: docs/06-prompts.md "Ortak kurallar"daki
// output_language kuralı burada geçerli değil, çünkü yanıt yorumun altına
// yazılacak, kullanıcının arayüz diline değil yorumun diline uymalı).
export function buildReplyDraftSystemPrompt(): string {
  return [
    "You write public owner replies to online reviews for a healthcare/aesthetic clinic.",
    "Rules:",
    "- Respond in the SAME language as the review text.",
    "- Keep the reply to 110 words or fewer.",
    "- Tone: warm, professional, and specific to what the reviewer praised or complained about.",
    "- NEVER quote the review verbatim — always paraphrase in your own words.",
    "- NEVER confirm or deny that the reviewer was a patient.",
    "- NEVER mention diagnoses, treatments performed, dates, or any other personal/health details.",
    "- NEVER give medical advice.",
    "- NEVER offer discounts, gifts, or other incentives, and never ask the reviewer to change or remove the review.",
    "- For a negative review: acknowledge the concern, apologize without admitting legal fault, and invite the",
    '  reviewer to continue the conversation privately via the clinic\'s contact details, written as the literal',
    '  placeholder "[iletişim]" if the review is in Turkish, or "[contact]" for any other language — the owner',
    "  fills this in themselves.",
    "- For a positive review: thank the reviewer and reinforce one specific positive theme they mentioned.",
    "- No emojis, no hashtags.",
    "- Return only JSON in the specified schema — no prose wrapper.",
  ].join("\n");
}

export function buildReplyDraftUserPrompt(input: ReplyDraftInput): string {
  const toneLabel = input.tone === "formal" ? "formal and reserved" : "warm and personable";

  return [
    `Clinic name: ${input.businessName}`,
    `Category: ${input.category ?? "unknown"}`,
    `Review rating: ${input.rating === null ? "unknown" : `${String(input.rating)}/5`}`,
    `Review language (hint, verify against the text itself): ${input.reviewLanguage ?? "unknown"}`,
    `Desired tone: ${toneLabel}`,
    "Review text:",
    input.reviewText,
    "",
    "Write the clinic owner's public reply to this review, following all system rules.",
  ].join("\n");
}
