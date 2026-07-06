import { renderToBuffer } from "@react-pdf/renderer";
import { type SupabaseClient } from "@supabase/supabase-js";

import { loadMonthlyReportData } from "@/lib/reports/monthly-report-data";
import { MonthlyReportDocument } from "@/lib/reports/monthly-report-document";
import { buildMonthlyReportStrings } from "@/lib/reports/monthly-report-strings";
import type { Database } from "@/types/database.types";

import { escapeHtml, fillTemplate, fillTemplateHtml } from "./email-template";
import { sendEmail } from "./resend-client";
import en from "../../../messages/en.json";
import tr from "../../../messages/tr.json";

type CronSupabaseClient = SupabaseClient<Database>;

const templatesByLocale: Record<"tr" | "en", typeof tr> = { tr, en };

const REPORT_CADENCE_DAYS = 30;

interface MonthlyReportDigestSummary {
  sent: number;
  skipped: number;
}

// bkz. docs/10-roadmap.md Faz 2 "Monthly Report e-posta kanalı" — mevcut PDF
// indirme aksiyonuna ek olarak, işletme başına ~30 günde bir aynı raporu
// otomatik e-posta ile gönderir. weekly-digest ile aynı idempotent desen:
// `businesses.monthly_report_emailed_at` son gönderim zamanını tutar, bu
// yüzden RESEND_API_KEY tanımsızken (skip) veya cron çift tetiklendiğinde
// tekrar gönderim olmaz. Locale kaynağı yok (bkz. weekly-digest.ts aynı not),
// `defaultLocale` (en) kullanılır.
export async function sendMonthlyReportEmails(
  supabase: CronSupabaseClient,
  locale: "tr" | "en" = "en",
): Promise<MonthlyReportDigestSummary> {
  const cutoff = new Date(Date.now() - REPORT_CADENCE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: dueBusinesses, error } = await supabase
    .from("businesses")
    .select("id, name, user_id, last_scraped_at, monthly_report_emailed_at")
    .not("last_scraped_at", "is", null)
    .or(`monthly_report_emailed_at.is.null,monthly_report_emailed_at.lt.${cutoff}`);

  if (error) {
    console.error("Aylık rapor e-postası için işletmeler okunamadı:", error);
    return { sent: 0, skipped: 0 };
  }

  const messages = templatesByLocale[locale].emails.monthlyReport;
  const reportStrings = buildMonthlyReportStrings(locale);
  let sent = 0;
  let skipped = 0;

  for (const business of dueBusinesses) {
    const { data: ownerUser } = await supabase
      .from("users")
      .select("email")
      .eq("id", business.user_id)
      .maybeSingle();

    if (!ownerUser?.email) {
      // Sahip bulunamıyorsa (silinmiş hesap vb.) sonsuz yeniden denemeyi
      // önlemek için gönderilmiş say.
      await supabase
        .from("businesses")
        .update({ monthly_report_emailed_at: new Date().toISOString() })
        .eq("id", business.id);
      skipped += 1;
      continue;
    }

    const data = await loadMonthlyReportData(supabase, business.id, business.name, locale);
    const pdfBuffer = await renderToBuffer(MonthlyReportDocument({ data, strings: reportStrings }));

    const html = `<h1>${fillTemplateHtml(messages.heading, { businessName: business.name })}</h1>
<p>${escapeHtml(messages.intro)}</p>
<ul>
<li>${fillTemplateHtml(messages.scoreLine, { score: data.score ?? "—" })}</li>
<li>${fillTemplateHtml(messages.rankLine, { rank: data.competitorRank ?? "—", total: data.competitorTotal })}</li>
<li>${fillTemplateHtml(messages.completedTasksLine, { count: data.completedTasksInPeriod })}</li>
<li>${fillTemplateHtml(messages.criticalIssuesLine, { count: data.criticalIssuesCount })}</li>
</ul>
<p>${escapeHtml(messages.attachmentNote)}</p>`;

    const result = await sendEmail({
      to: ownerUser.email,
      subject: fillTemplate(messages.subject, { businessName: business.name }),
      html,
      attachments: [{ filename: "clinicradar-monthly-report.pdf", content: pdfBuffer.toString("base64") }],
    });

    if (!result.ok) {
      // RESEND_API_KEY yok (skipped) veya gönderim gerçekten başarısız oldu
      // (ör. Resend 4xx/5xx) — her iki durumda da monthly_report_emailed_at
      // güncellenmez ki bir sonraki çalıştırmada tekrar denensin. Başarısız
      // gönderimi "sent" saymak, hatayı sessizce gizler.
      skipped += 1;
      continue;
    }

    await supabase
      .from("businesses")
      .update({ monthly_report_emailed_at: new Date().toISOString() })
      .eq("id", business.id);
    sent += 1;
  }

  return { sent, skipped };
}
