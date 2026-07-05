import { type SupabaseClient } from "@supabase/supabase-js";

import { AUTO_DISMISS_STALE_DAYS } from "@/lib/constants";
import type { Database } from "@/types/database.types";

import { recordNotification } from "./record-notification";

type NotifySupabaseClient = SupabaseClient<Database>;

// bkz. docs/02-business-rules.md Bölüm G / docs/09-task-engine.md "Otomatik
// dismiss (60 gün kuralı)" — `priority = 'low'` olan `open` görevler
// oluşturulduktan AUTO_DISMISS_STALE_DAYS gün sonra hâlâ açıksa otomatik
// `dismissed` olur ve her biri için `task_auto_dismissed` bildirimi kaydedilir.
// Plan/tier'dan bağımsız çalışır — cron her business için (Free dahil) günde
// bir kez çağrılmalıdır.
export async function autoDismissStaleTasks(
  supabase: NotifySupabaseClient,
  businessId: string,
): Promise<{ dismissed: number }> {
  const cutoffIso = new Date(Date.now() - AUTO_DISMISS_STALE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data: staleTasks, error: selectError } = await supabase
    .from("tasks")
    .select("id, theme, title_i18n")
    .eq("business_id", businessId)
    .eq("status", "open")
    .eq("priority", "low")
    .lt("created_at", cutoffIso);

  if (selectError) {
    console.error("Auto-dismiss için görevler okunamadı:", selectError);
    return { dismissed: 0 };
  }

  if (staleTasks.length === 0) {
    return { dismissed: 0 };
  }

  const ids = staleTasks.map((t) => t.id);
  const { error: updateError } = await supabase
    .from("tasks")
    .update({ status: "dismissed", last_priority_recalc_at: new Date().toISOString() })
    .in("id", ids);

  if (updateError) {
    console.error("Auto-dismiss güncellemesi başarısız:", updateError);
    return { dismissed: 0 };
  }

  for (const task of staleTasks) {
    await recordNotification(supabase, {
      businessId,
      type: "task_auto_dismissed",
      payload: { task_id: task.id, theme: task.theme, title_i18n: task.title_i18n },
    });
  }

  return { dismissed: staleTasks.length };
}
