import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

const SUBSCRIPTION_EVENTS = new Set([
  "subscription_created",
  "subscription_updated",
  "subscription_cancelled",
  "subscription_resumed",
  "subscription_expired",
  "subscription_paused",
  "subscription_unpaused",
  "subscription_payment_failed",
  "subscription_payment_success",
]);

export interface LemonSqueezyWebhookPayload {
  meta: {
    event_name: string;
    custom_data?: { user_id?: string };
  };
  data: {
    id: string;
    attributes: {
      customer_id: number;
      variant_id: number;
      status: string;
      renews_at: string | null;
      ends_at: string | null;
      urls?: { customer_portal?: string };
    };
  };
}

function mapStatus(lemonSqueezyStatus: string): "active" | "canceled" | "past_due" {
  switch (lemonSqueezyStatus) {
    case "active":
    case "on_trial":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    default:
      return "canceled";
  }
}

function mapPlan(variantId: number): "free" | "pro" {
  return String(variantId) === process.env.LEMONSQUEEZY_PRO_VARIANT_ID ? "pro" : "free";
}

export async function handleWebhookEvent(
  supabase: SupabaseClient<Database>,
  payload: LemonSqueezyWebhookPayload,
): Promise<void> {
  if (!SUBSCRIPTION_EVENTS.has(payload.meta.event_name)) {
    return;
  }

  const { id, attributes } = payload.data;
  const update = {
    plan: mapPlan(attributes.variant_id),
    status: mapStatus(attributes.status),
    current_period_end: attributes.renews_at ?? attributes.ends_at,
    lemonsqueezy_customer_id: String(attributes.customer_id),
    lemonsqueezy_subscription_id: id,
    lemonsqueezy_variant_id: String(attributes.variant_id),
    lemonsqueezy_customer_portal_url: attributes.urls?.customer_portal ?? null,
  };

  const userId = payload.meta.custom_data?.user_id;

  if (userId) {
    await supabase.from("subscriptions").update(update).eq("user_id", userId);
    return;
  }

  await supabase.from("subscriptions").update(update).eq("lemonsqueezy_subscription_id", id);
}
