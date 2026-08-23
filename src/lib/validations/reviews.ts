import { z } from "zod";

// bkz. docs/06-prompts.md "Yorum Yanıt Taslağı" — ton seçimi opsiyonel,
// route varsayılan olarak "warm" kullanır.
export const createReplyDraftSchema = z.object({
  tone: z.enum(["warm", "formal"]).optional(),
});

export type CreateReplyDraftInput = z.infer<typeof createReplyDraftSchema>;

// bkz. docs/02-business-rules.md Bölüm J — "Yanıtladım" işareti owner_reply'i
// DOLDURMAZ, sadece kullanıcı arayüzünde bir hatırlatma sinyalidir.
export const updateReviewReplyMarkedSchema = z.object({
  replyMarked: z.boolean(),
});

export type UpdateReviewReplyMarkedInput = z.infer<typeof updateReviewReplyMarkedSchema>;
