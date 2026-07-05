import { type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

import { escapeHtml, fillTemplate, fillTemplateHtml } from "./email-template";
import { sendEmail } from "./resend-client";
import en from "../../../messages/en.json";
import tr from "../../../messages/tr.json";

type NotifySupabaseClient = SupabaseClient<Database>;

const templatesByLocale: Record<"tr" | "en", typeof tr> = { tr, en };

interface NotificationRow {
  id: string;
  business_id: string;
  type: string;
  payload: Record<string, unknown>;
}

// bkz. docs/02-business-rules.md Bölüm G — haftalık özet, `emailed_at IS NULL`
// olan (yani anlık gönderilmemiş: 'competitor_review_delta' ve
// 'task_auto_dismissed') bildirimleri işletme başına toplayıp tek e-postada
// gönderir, ardından hepsini `emailed_at` ile işaretler (idempotent — bir
// sonraki çağrıda aynı satırlar tekrar gönderilmez). Locale kaynağı yok
// (bkz. docs/11-risks-assumptions.md Risk 1 önlemleri) — bu yüzden
// `defaultLocale` (en) kullanılır; TODO: businesses tablosuna locale sütunu
// eklenirse per-user dil desteklenebilir.
export async function sendWeeklyDigests(
  supabase: NotifySupabaseClient,
  locale: "tr" | "en" = "en",
): Promise<{ sent: number; skipped: number }> {
  const { data: pending, error } = await supabase
    .from("notifications")
    .select("id, business_id, type, payload")
    .is("emailed_at", null);

  if (error) {
    console.error("Haftalık özet için bildirimler okunamadı:", error);
    return { sent: 0, skipped: 0 };
  }

  const rows = pending as NotificationRow[];
  if (rows.length === 0) {
    return { sent: 0, skipped: 0 };
  }

  const byBusiness = new Map<string, NotificationRow[]>();
  for (const row of rows) {
    const list = byBusiness.get(row.business_id) ?? [];
    list.push(row);
    byBusiness.set(row.business_id, list);
  }

  const messages = templatesByLocale[locale].emails.weeklyDigest;
  let sent = 0;
  let skipped = 0;

  for (const [businessId, businessRows] of byBusiness) {
    const { data: business } = await supabase
      .from("businesses")
      .select("id, name, user_id")
      .eq("id", businessId)
      .maybeSingle();

    const ids = businessRows.map((r) => r.id);

    if (!business) {
      // İşletme silinmiş olabilir — sarkan bildirimleri emailed_at ile kapat.
      await supabase.from("notifications").update({ emailed_at: new Date().toISOString() }).in("id", ids);
      skipped += 1;
      continue;
    }

    const { data: ownerUser } = await supabase
      .from("users")
      .select("email")
      .eq("id", business.user_id)
      .maybeSingle();

    const lines = businessRows.map((row) => {
      const theme = typeof row.payload.theme === "string" ? row.payload.theme : "";
      if (row.type === "task_auto_dismissed") {
        const title = row.payload.title_i18n as Record<string, string> | undefined;
        return fillTemplateHtml(messages.dismissedLine, { theme: title?.[locale] ?? theme });
      }
      if (row.type === "theme_spike") {
        return fillTemplateHtml(messages.themeSpikeLine, { theme });
      }
      return fillTemplateHtml(messages.newTaskLine, { theme });
    });

    const html = `<h1>${fillTemplateHtml(messages.heading, { businessName: business.name })}</h1><p>${escapeHtml(messages.intro)}</p><ul>${lines
      .map((l) => `<li>${l}</li>`)
      .join("")}</ul>`;

    if (ownerUser?.email) {
      const result = await sendEmail({
        to: ownerUser.email,
        subject: fillTemplate(messages.subject, { businessName: business.name }),
        html,
      });
      if (result.skipped) {
        // RESEND_API_KEY yok — akış devam eder ama bu döngüde emailed_at
        // işaretlenmez ki key eklendiğinde bildirimler yine gönderilebilsin.
        skipped += 1;
        continue;
      }
    }

    await supabase.from("notifications").update({ emailed_at: new Date().toISOString() }).in("id", ids);
    sent += 1;
  }

  return { sent, skipped };
}
