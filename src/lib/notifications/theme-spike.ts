import { type SupabaseClient } from "@supabase/supabase-js";

import type { AggregatedTheme } from "@/lib/ai-pipeline/aggregate-competitor-themes";
import {
  CRITICAL_SIGNAL_MENTION_MULTIPLIER,
  CRITICAL_SIGNAL_MIN_PREVIOUS_MENTIONS,
} from "@/lib/constants";
import { normalizeTheme } from "@/lib/task-engine/reopen";
import type { Database } from "@/types/database.types";

import { escapeHtml, fillTemplate, fillTemplateHtml } from "./email-template";
import { recordNotification } from "./record-notification";
import { sendEmail } from "./resend-client";
import en from "../../../messages/en.json";
import tr from "../../../messages/tr.json";

type NotifySupabaseClient = SupabaseClient<Database>;

interface MentionCounts {
  positive_mentions: number;
  negative_mentions: number;
}

const templatesByLocale: Record<"tr" | "en", typeof tr> = { tr, en };

// bkz. docs/02-business-rules.md Bölüm G kural 3 — Pro plan işletmeler için,
// bir temanın toplam mention'ı (own) bir önceki döngüye göre
// CRITICAL_SIGNAL_MENTION_MULTIPLIER kat veya fazlası artarsa (ve önceki
// döngüde en az CRITICAL_SIGNAL_MIN_PREVIOUS_MENTIONS mention varsa) anlık
// bildirim kaydedilir + (RESEND_API_KEY tanımlıysa) hemen e-posta gönderilir.
// Diğer iki bildirim türünün aksine bu satır `markEmailedNow: true` ile
// kaydedilir — haftalık özete tekrar düşmemesi için.
export async function detectAndNotifyThemeSpikes(
  supabase: NotifySupabaseClient,
  input: {
    businessId: string;
    businessName: string;
    isPro: boolean;
    ownerEmail: string | null;
    locale: "tr" | "en";
    ownAggregated: AggregatedTheme[];
    previousCounts: Map<string, MentionCounts>;
  },
): Promise<void> {
  if (!input.isPro) {
    return;
  }

  const messages = templatesByLocale[input.locale].emails.themeSpike;

  for (const theme of input.ownAggregated) {
    const prev = input.previousCounts.get(`own|${normalizeTheme(theme.theme)}`);
    if (!prev) {
      continue;
    }
    const prevTotal = prev.positive_mentions + prev.negative_mentions;
    const nextTotal = theme.positive_mentions + theme.negative_mentions;
    if (prevTotal < CRITICAL_SIGNAL_MIN_PREVIOUS_MENTIONS) {
      continue;
    }
    if (nextTotal < prevTotal * CRITICAL_SIGNAL_MENTION_MULTIPLIER) {
      continue;
    }

    const multiplier = Math.round((nextTotal / prevTotal) * 10) / 10;

    await recordNotification(supabase, {
      businessId: input.businessId,
      type: "theme_spike",
      payload: { theme: theme.theme, prev_total: prevTotal, next_total: nextTotal, multiplier },
      markEmailedNow: true,
    });

    if (input.ownerEmail) {
      const subject = fillTemplate(messages.subject, { businessName: input.businessName, theme: theme.theme });
      const heading = escapeHtml(messages.heading);
      const body = fillTemplateHtml(messages.body, {
        businessName: input.businessName,
        theme: theme.theme,
        multiplier,
      });
      await sendEmail({
        to: input.ownerEmail,
        subject,
        html: `<h1>${heading}</h1><p>${body}</p>`,
      });
    }
  }
}
