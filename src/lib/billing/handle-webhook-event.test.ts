import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  handleWebhookEvent,
  type LemonSqueezyWebhookPayload,
} from "@/lib/billing/handle-webhook-event";
import type { Database } from "@/types/database.types";

const PRO_VARIANT_ID = "111222";

interface SubscriptionUpdate {
  plan: "free" | "pro";
  status: "active" | "canceled" | "past_due";
  current_period_end: string | null;
  lemonsqueezy_customer_id: string;
  lemonsqueezy_subscription_id: string;
  lemonsqueezy_variant_id: string;
  lemonsqueezy_customer_portal_url: string | null;
  lemonsqueezy_updated_at: string | null;
}

// Supabase zinciri: from("subscriptions").update(u).eq(...)[.or(...)] → await.
// Zincirin sonu thenable olduğu için await doğrudan çalışır; sorgu gerçek bir
// ağ çağrısı yapmaz, yalnızca çağrıları kaydeder.
function createSupabaseMock() {
  const calls = {
    from: [] as string[],
    update: [] as SubscriptionUpdate[],
    eq: [] as [string, string][],
    or: [] as string[],
  };

  const query = {
    eq(column: string, value: string) {
      calls.eq.push([column, value]);
      return query;
    },
    or(expression: string) {
      calls.or.push(expression);
      return query;
    },
    then(resolve: (value: { data: null; error: null }) => void) {
      resolve({ data: null, error: null });
    },
  };

  const supabase = {
    from(table: string) {
      calls.from.push(table);
      return {
        update(update: SubscriptionUpdate) {
          calls.update.push(update);
          return query;
        },
      };
    },
  } as unknown as SupabaseClient<Database>;

  return { supabase, calls };
}

function makePayload(
  overrides: {
    event_name?: string;
    custom_data?: { user_id?: string };
    attributes?: Partial<LemonSqueezyWebhookPayload["data"]["attributes"]>;
    id?: string;
  } = {},
): LemonSqueezyWebhookPayload {
  return {
    meta: {
      event_name: overrides.event_name ?? "subscription_updated",
      ...(overrides.custom_data !== undefined ? { custom_data: overrides.custom_data } : {}),
    },
    data: {
      id: overrides.id ?? "sub-1",
      attributes: {
        customer_id: 42,
        variant_id: Number(PRO_VARIANT_ID),
        status: "active",
        renews_at: "2026-08-01T00:00:00Z",
        ends_at: null,
        ...overrides.attributes,
      },
    },
  };
}

describe("handleWebhookEvent", () => {
  beforeEach(() => {
    vi.stubEnv("LEMONSQUEEZY_PRO_VARIANT_ID", PRO_VARIANT_ID);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("abonelik dışı event'leri (ör. subscription_payment_success) yok sayar", async () => {
    const { supabase, calls } = createSupabaseMock();
    await handleWebhookEvent(supabase, makePayload({ event_name: "subscription_payment_success" }));
    expect(calls.from).toHaveLength(0);
  });

  it("pro variant + active status doğru update alanlarına eşlenir", async () => {
    const { supabase, calls } = createSupabaseMock();
    await handleWebhookEvent(
      supabase,
      makePayload({
        custom_data: { user_id: "user-1" },
        attributes: { urls: { customer_portal: "https://portal.example" } },
      }),
    );

    expect(calls.from).toEqual(["subscriptions"]);
    expect(calls.update).toEqual([
      {
        plan: "pro",
        status: "active",
        current_period_end: "2026-08-01T00:00:00Z",
        lemonsqueezy_customer_id: "42",
        lemonsqueezy_subscription_id: "sub-1",
        lemonsqueezy_variant_id: PRO_VARIANT_ID,
        lemonsqueezy_customer_portal_url: "https://portal.example",
        lemonsqueezy_updated_at: null,
      },
    ]);
    expect(calls.eq).toEqual([["user_id", "user-1"]]);
  });

  it("custom_data.user_id yoksa lemonsqueezy_subscription_id ile eşleştirir", async () => {
    const { supabase, calls } = createSupabaseMock();
    await handleWebhookEvent(supabase, makePayload({ id: "sub-9" }));
    expect(calls.eq).toEqual([["lemonsqueezy_subscription_id", "sub-9"]]);
  });

  it.each([
    ["on_trial", "active"],
    ["past_due", "past_due"],
    ["unpaid", "past_due"],
    ["expired", "canceled"],
    ["cancelled", "canceled"],
  ] as const)("LemonSqueezy status '%s' → '%s'", async (input, expected) => {
    const { supabase, calls } = createSupabaseMock();
    await handleWebhookEvent(supabase, makePayload({ attributes: { status: input } }));
    expect(calls.update[0].status).toBe(expected);
  });

  it("pro variant dışındaki variant_id plan'ı 'free' yapar", async () => {
    const { supabase, calls } = createSupabaseMock();
    await handleWebhookEvent(supabase, makePayload({ attributes: { variant_id: 999 } }));
    expect(calls.update[0].plan).toBe("free");
    expect(calls.update[0].lemonsqueezy_variant_id).toBe("999");
  });

  it("renews_at null ise current_period_end için ends_at kullanılır", async () => {
    const { supabase, calls } = createSupabaseMock();
    await handleWebhookEvent(
      supabase,
      makePayload({ attributes: { renews_at: null, ends_at: "2026-09-01T00:00:00Z" } }),
    );
    expect(calls.update[0].current_period_end).toBe("2026-09-01T00:00:00Z");
  });

  it("updated_at damgası varsa sırasız teslim guard'ı (.or) eklenir", async () => {
    const { supabase, calls } = createSupabaseMock();
    await handleWebhookEvent(
      supabase,
      makePayload({ attributes: { updated_at: "2026-07-15T10:00:00Z" } }),
    );
    expect(calls.update[0].lemonsqueezy_updated_at).toBe("2026-07-15T10:00:00Z");
    expect(calls.or).toEqual([
      'lemonsqueezy_updated_at.is.null,lemonsqueezy_updated_at.lte."2026-07-15T10:00:00Z"',
    ]);
  });

  it("updated_at damgası yoksa guard atlanır, koşulsuz uygulanır", async () => {
    const { supabase, calls } = createSupabaseMock();
    await handleWebhookEvent(supabase, makePayload());
    expect(calls.or).toHaveLength(0);
  });
});
