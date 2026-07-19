import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendWeeklyDigests } from "@/lib/notifications/weekly-digest";
import type { Database } from "@/types/database.types";

import tr from "../../../messages/tr.json";

const sendEmailMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/notifications/resend-client", () => ({
  sendEmail: sendEmailMock,
}));

interface NotificationRow {
  id: string;
  business_id: string;
  type: string;
  payload: Record<string, unknown>;
}

interface BusinessRow {
  id: string;
  name: string;
  user_id: string;
}

interface UserRow {
  email: string;
  preferred_locale: string;
}

// Supabase zinciri gerçek ağ çağrısı yapmaz; tablo bazında sabit veri döner.
// Zincir uçları (is / maybeSingle / in) thenable olduğu için await doğrudan çalışır.
function createSupabaseMock(input: {
  notifications: NotificationRow[];
  businesses: BusinessRow[];
  usersById: Record<string, UserRow>;
}) {
  const updates: { table: string; ids: string[] }[] = [];

  const supabase = {
    from(table: string) {
      return {
        select() {
          return {
            is() {
              return Promise.resolve({ data: input.notifications, error: null });
            },
            eq(_column: string, value: string) {
              return {
                maybeSingle() {
                  if (table === "businesses") {
                    const business = input.businesses.find((b) => b.id === value) ?? null;
                    return Promise.resolve({ data: business, error: null });
                  }
                  return Promise.resolve({ data: input.usersById[value] ?? null, error: null });
                },
              };
            },
          };
        },
        update() {
          return {
            in(_column: string, ids: string[]) {
              updates.push({ table, ids });
              return Promise.resolve({ data: null, error: null });
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient<Database>;

  return { supabase, updates };
}

describe("sendWeeklyDigests locale seçimi", () => {
  beforeEach(() => {
    sendEmailMock.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("işletme sahibinin preferred_locale değeriyle (tr) şablon seçer", async () => {
    const { supabase } = createSupabaseMock({
      notifications: [
        { id: "n1", business_id: "b1", type: "competitor_review_delta", payload: { theme: "hijyen" } },
      ],
      businesses: [{ id: "b1", name: "Klinik A", user_id: "u1" }],
      usersById: { u1: { email: "a@example.com", preferred_locale: "tr" } },
    });

    const result = await sendWeeklyDigests(supabase);

    expect(result).toEqual({ sent: 1, skipped: 0 });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const call = sendEmailMock.mock.calls[0][0] as { to: string; subject: string };
    expect(call.to).toBe("a@example.com");
    expect(call.subject).toBe(
      tr.emails.weeklyDigest.subject.replace("{businessName}", "Klinik A"),
    );
  });

  it("bilinmeyen/eksik preferred_locale değerinde fallback (en) kullanır", async () => {
    const { supabase } = createSupabaseMock({
      notifications: [
        { id: "n1", business_id: "b1", type: "competitor_review_delta", payload: { theme: "wait" } },
      ],
      businesses: [{ id: "b1", name: "Clinic B", user_id: "u1" }],
      usersById: { u1: { email: "b@example.com", preferred_locale: "de" } },
    });

    await sendWeeklyDigests(supabase);

    const call = sendEmailMock.mock.calls[0][0] as { subject: string };
    expect(call.subject).toBe("Your weekly ClinicRadar summary for Clinic B");
  });

  it("farklı sahipler kendi dillerinde ayrı e-posta alır", async () => {
    const { supabase, updates } = createSupabaseMock({
      notifications: [
        { id: "n1", business_id: "b1", type: "competitor_review_delta", payload: { theme: "x" } },
        { id: "n2", business_id: "b2", type: "competitor_review_delta", payload: { theme: "y" } },
      ],
      businesses: [
        { id: "b1", name: "Klinik TR", user_id: "u1" },
        { id: "b2", name: "Clinic EN", user_id: "u2" },
      ],
      usersById: {
        u1: { email: "tr@example.com", preferred_locale: "tr" },
        u2: { email: "en@example.com", preferred_locale: "en" },
      },
    });

    const result = await sendWeeklyDigests(supabase);

    expect(result).toEqual({ sent: 2, skipped: 0 });
    const subjects = sendEmailMock.mock.calls.map((c) => (c[0] as { subject: string }).subject);
    expect(subjects).toContain(tr.emails.weeklyDigest.subject.replace("{businessName}", "Klinik TR"));
    expect(subjects).toContain("Your weekly ClinicRadar summary for Clinic EN");
    // Her iki işletmenin bildirimleri emailed_at ile işaretlenmiş olmalı.
    expect(updates.map((u) => u.ids)).toEqual([["n1"], ["n2"]]);
  });
});
