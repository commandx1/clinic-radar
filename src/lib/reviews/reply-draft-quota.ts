import { FREE_PLAN_REPLY_DRAFTS_PER_MONTH } from "@/lib/constants";

// bkz. docs/02-business-rules.md Bölüm A, Bölüm J. Pro/Agency sınırsız; Free
// plan son 30 günde üretilen taslak sayısına göre sınırlanır. Sayım route
// tarafında yapılır (reviews.reply_draft_generated_at >= now - 30g), bu
// fonksiyon saf karar mantığını test edilebilir tutar.
export function canGenerateReplyDraft(input: { isPro: boolean; generatedLast30Days: number }): boolean {
  if (input.isPro) {
    return true;
  }
  return input.generatedLast30Days < FREE_PLAN_REPLY_DRAFTS_PER_MONTH;
}
