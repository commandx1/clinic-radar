import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database.types";

// RLS bypass eden dar istisna — bkz. CLAUDE.md "Mimari Kurallar": bu client
// SADECE `CRON_SECRET` korumalı `src/app/api/cron/**` route'larında kullanılır
// (kullanıcı oturumu olmadan çalıştıkları için service-role gerekir). Başka
// hiçbir yerde import edilmemeli — authenticated context dışındaki her sorgu
// RLS'i atlar.
export function createAdminClient(): SupabaseClient<Database> {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
