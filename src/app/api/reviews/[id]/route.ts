import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { updateReviewReplyMarkedSchema } from "@/lib/validations/reviews";

// bkz. docs/04-api.md — kullanıcı taslağı elle Google/Trustpilot'a
// yapıştırdıktan sonra "Yanıtladım" işaretler/geri alır. Bu, `owner_reply`
// alanını DOLDURMAZ (o alan yalnızca kaynaktan yeniden çekilen gerçek
// yanıtla dolar) — sadece bir UI hatırlatma sinyali (docs/02-business-rules.md
// Bölüm J).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body: unknown = await request.json();
  const parsed = updateReviewReplyMarkedSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  // Sahiplik kontrolü: yalnızca kendi işletmesinin own yorumunu işaretleyebilir.
  const { data: review } = await supabase
    .from("reviews")
    .select("id, business_id, owner_type")
    .eq("id", id)
    .maybeSingle();

  if (review?.owner_type !== "own") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id")
    .eq("id", review.business_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!business) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: updated, error } = await supabase
    .from("reviews")
    .update({ reply_marked_at: parsed.data.replyMarked ? new Date().toISOString() : null })
    .eq("id", id)
    .select("id, reply_marked_at")
    .maybeSingle();

  if (error) {
    console.error("Failed to update review reply-marked state:", error);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ review: updated });
}
