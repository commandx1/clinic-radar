import { type SupabaseClient } from "@supabase/supabase-js";

import type { Database, Json } from "@/types/database.types";

type NotifySupabaseClient = SupabaseClient<Database>;

// `notifications.type` sütunu DB'de CHECK constraint ile bu üç değere
// kısıtlıdır (bkz. supabase/migrations/20260707000000_notifications.sql);
// generated types sütunu düz `string` olarak üretir, bu yüzden literal union
// burada elle tanımlanır — bkz. docs/02-business-rules.md Bölüm G.
export type NotificationType =
  | "competitor_review_delta"
  | "theme_spike"
  | "task_auto_dismissed";

// bkz. docs/02-business-rules.md Bölüm G — tüm bildirim satırları tek bu
// fonksiyondan geçer; ham yorum metni ASLA payload'a konmaz (bkz.
// docs/02-business-rules.md Bölüm H), yalnızca tema adı/sayısal metrikler
// gibi zaten UI'da gösterilen türetilmiş veriler payload'a girer.
export async function recordNotification(
  supabase: NotifySupabaseClient,
  input: {
    businessId: string;
    type: NotificationType;
    payload: Record<string, unknown>;
    // Anlık gönderilen bildirimler (kritik sinyal) haftalık özete tekrar
    // düşmesin diye kayıt anında emailed_at doldurulur.
    markEmailedNow?: boolean;
  },
): Promise<void> {
  const { error } = await supabase.from("notifications").insert({
    business_id: input.businessId,
    type: input.type,
    payload: input.payload as Json,
    emailed_at: input.markEmailedNow ? new Date().toISOString() : null,
  });

  if (error) {
    console.error("Bildirim kaydedilemedi:", input.type, error);
  }
}
