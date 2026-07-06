import { NextResponse } from "next/server";

import { handleWebhookEvent, type LemonSqueezyWebhookPayload } from "@/lib/billing/handle-webhook-event";
import { verifyWebhookSignature } from "@/lib/billing/verify-webhook-signature";
import { createAdminClient } from "@/lib/supabase/admin";

// LemonSqueezy kullanıcı oturumu olmadan çağırır (bkz. docs/04-api.md), bu
// yüzden CLAUDE.md'deki admin client dar istisnasına /api/cron/** ile
// birlikte dahil edildi — imza doğrulaması (X-Signature) tek güvenlik sınırı.
export async function POST(request: Request) {
  const webhookSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("LEMONSQUEEZY_WEBHOOK_SECRET tanımlı değil — webhook fail-closed kapalı.");
    return NextResponse.json({ error: "webhook_secret_not_configured" }, { status: 500 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-signature");

  if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  const payload = JSON.parse(rawBody) as LemonSqueezyWebhookPayload;
  const supabase = createAdminClient();
  await handleWebhookEvent(supabase, payload);

  return NextResponse.json({ received: true });
}
