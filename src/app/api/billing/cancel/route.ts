import { NextResponse } from "next/server";

import { cancelSubscription } from "@/lib/billing/lemonsqueezy-client";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: subscription, error: fetchError } = await supabase
    .from("subscriptions")
    .select("lemonsqueezy_subscription_id, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError) {
    console.error("Failed to fetch subscription for cancellation:", fetchError);
    return NextResponse.json({ error: "cancel_failed" }, { status: 500 });
  }

  if (!subscription?.lemonsqueezy_subscription_id) {
    return NextResponse.json({ error: "no_active_subscription" }, { status: 404 });
  }

  if (subscription.status === "canceled") {
    return NextResponse.json({ error: "already_canceled" }, { status: 409 });
  }

  try {
    await cancelSubscription(subscription.lemonsqueezy_subscription_id);
  } catch (error) {
    console.error("Failed to cancel subscription:", error);
    return NextResponse.json({ error: "cancel_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
