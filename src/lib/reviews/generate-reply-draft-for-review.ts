import { type SupabaseClient } from "@supabase/supabase-js";

import { generateReplyDraft } from "@/lib/ai-pipeline/provider";
import { hasProAccess } from "@/lib/billing/plan-access";
import { canGenerateReplyDraft } from "@/lib/reviews/reply-draft-quota";
import type { Database } from "@/types/database.types";

type ReplySupabaseClient = SupabaseClient<Database>;

interface ReplyDraftServiceResult {
  status: number;
  body: Record<string, unknown>;
}

// bkz. docs/02-business-rules.md Bölüm J — kota son 30 günlük hareketli
// pencereyle sayılır, takvim ayı değil.
const REPLY_DRAFT_QUOTA_WINDOW_DAYS = 30;

// Şema uyuşmazlığında (null) bir kez daha dener; SDK/ağ hatasında da aynı
// şekilde bir kez daha dener. İki deneme de başarısızsa null döner —
// execute-analysis.ts'teki withRetryOnce ile birebir aynı desen (o dosyaya
// dokunulmuyor — bu route kendi kopyasını tutar, CLAUDE.md kapsam kısıtı).
async function withRetryOnce<T>(fn: () => Promise<T | null>): Promise<T | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await fn();
      if (result) {
        return result;
      }
    } catch (err) {
      console.error("Reply draft generation attempt failed:", err);
    }
  }
  return null;
}

// Route (`/api/reviews/:id/reply-draft`) sadece auth + provider guard'ını
// yapar, iş kuralları (sahiplik, kota, üretim, kalıcılaştırma) burada
// toplanır — run-manual-analysis.ts ile aynı desen (dosya başına ~100 satır
// sınırı, CLAUDE.md).
export async function generateReplyDraftForReview(
  supabase: ReplySupabaseClient,
  reviewId: string,
  userId: string,
  tone: "warm" | "formal",
): Promise<ReplyDraftServiceResult> {
  const { data: review } = await supabase
    .from("reviews")
    .select("id, business_id, owner_type, text, rating, original_language, owner_reply")
    .eq("id", reviewId)
    .maybeSingle();

  if (review?.owner_type !== "own") {
    return { status: 404, body: { error: "not_found" } };
  }

  if (review.text === null) {
    return { status: 400, body: { error: "no_review_text" } };
  }

  const [{ data: business }, { data: subscription }] = await Promise.all([
    supabase.from("businesses").select("id, name, category").eq("id", review.business_id).eq("user_id", userId).maybeSingle(),
    supabase
      .from("subscriptions")
      .select("plan, status, current_period_end")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (!business) {
    return { status: 404, body: { error: "not_found" } };
  }

  if (review.owner_reply !== null) {
    return { status: 409, body: { error: "already_replied" } };
  }

  const isPro = hasProAccess(subscription);
  const cutoffIso = new Date(Date.now() - REPLY_DRAFT_QUOTA_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("business_id", business.id)
    .eq("owner_type", "own")
    .gte("reply_draft_generated_at", cutoffIso);

  if (!canGenerateReplyDraft({ isPro, generatedLast30Days: count ?? 0 })) {
    return { status: 403, body: { error: "quota_exceeded" } };
  }

  const reviewText = review.text;
  const draft = await withRetryOnce(() =>
    generateReplyDraft({
      businessName: business.name,
      category: business.category,
      rating: review.rating,
      reviewText,
      reviewLanguage: review.original_language,
      tone,
    }),
  );

  if (!draft) {
    return { status: 502, body: { error: "draft_failed" } };
  }

  const { error } = await supabase
    .from("reviews")
    .update({ reply_draft: draft.reply, reply_draft_generated_at: new Date().toISOString() })
    .eq("id", reviewId);

  if (error) {
    console.error("Failed to persist reply draft:", error);
    return { status: 500, body: { error: "update_failed" } };
  }

  return { status: 200, body: { reply_draft: draft.reply } };
}
