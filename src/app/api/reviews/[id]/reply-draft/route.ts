import { NextResponse } from "next/server";
import { z } from "zod";

import { assertProviderConfigured } from "@/lib/ai-pipeline/provider";
import { generateReplyDraftForReview } from "@/lib/reviews/generate-reply-draft-for-review";
import { createClient } from "@/lib/supabase/server";
import { createReplyDraftSchema } from "@/lib/validations/reviews";

// bkz. docs/04-api.md — kullanıcının kendi (owner_type='own') yanıtlanmamış
// bir yorumu için AI taslak yanıt üretir. İş kuralları (sahiplik, kota,
// zaten yanıtlanmış kontrolü, kalıcılaştırma) dosya başına ~100 satır sınırı
// (CLAUDE.md) nedeniyle generate-reply-draft-for-review.ts'e taşındı —
// run-manual-analysis.ts ile aynı desen.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    assertProviderConfigured();
  } catch {
    return NextResponse.json({ error: "ai_provider_not_configured" }, { status: 502 });
  }

  const body: unknown = await request.json();
  const parsed = createReplyDraftSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  const { status, body: resultBody } = await generateReplyDraftForReview(
    supabase,
    id,
    user.id,
    parsed.data.tone ?? "warm",
  );

  return NextResponse.json(resultBody, { status });
}
