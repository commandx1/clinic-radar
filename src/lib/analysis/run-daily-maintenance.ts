import { type SupabaseClient } from "@supabase/supabase-js";

import { autoDismissStaleTasks } from "@/lib/notifications/auto-dismiss";
import { sendMonthlyReportEmails } from "@/lib/notifications/monthly-report-digest";
import { sendWeeklyDigests } from "@/lib/notifications/weekly-digest";
import type { Database } from "@/types/database.types";

type CronSupabaseClient = SupabaseClient<Database>;

interface DailyMaintenanceSummary {
  autoDismissed: number;
  digestSent: number;
  digestSkipped: number;
  monthlyReportSent: number;
  monthlyReportSkipped: number;
}

// bkz. docs/02-business-rules.md Bölüm G + docs/09-task-engine.md "Otomatik
// dismiss (60 gün kuralı)" — vercel.json'da tek bir cron path'i (haftalık
// analiz) tanımlı olduğu için (bkz. vercel.json), plan/tier'dan bağımsız
// günlük bakım işleri (auto-dismiss taraması TÜM işletmeler için, ardından
// haftalık özet e-postası) aynı günlük tetikleme içinde, Pro analiz
// döngüsünden BAĞIMSIZ olarak burada çalıştırılır. Dosya başına ~100 satır
// sınırı (CLAUDE.md) nedeniyle route.ts'den ayrıldı.
export async function runDailyMaintenance(supabase: CronSupabaseClient): Promise<DailyMaintenanceSummary> {
  const { data: allBusinesses, error } = await supabase.from("businesses").select("id");

  if (error) {
    console.error("Günlük bakım için işletmeler okunamadı:", error);
    return { autoDismissed: 0, digestSent: 0, digestSkipped: 0, monthlyReportSent: 0, monthlyReportSkipped: 0 };
  }

  let autoDismissed = 0;
  for (const business of allBusinesses) {
    const { dismissed } = await autoDismissStaleTasks(supabase, business.id);
    autoDismissed += dismissed;
  }

  const { sent, skipped } = await sendWeeklyDigests(supabase);
  const monthlyReport = await sendMonthlyReportEmails(supabase);

  return {
    autoDismissed,
    digestSent: sent,
    digestSkipped: skipped,
    monthlyReportSent: monthlyReport.sent,
    monthlyReportSkipped: monthlyReport.skipped,
  };
}
