import { NextResponse } from "next/server";

import { assertProviderConfigured } from "@/lib/ai-pipeline/provider";
import { runCronAnalysisCycle } from "@/lib/analysis/run-cron-analysis-cycle";
import { runDailyMaintenance } from "@/lib/analysis/run-daily-maintenance";
import { createAdminClient } from "@/lib/supabase/admin";

// bkz. docs/02-business-rules.md Bölüm A — Pro plan haftalık analiz döngüsü.
// Vercel Cron tarafından tetiklenir (bkz. CLAUDE.md: /api/cron/** route'ları
// "Authorization: Bearer ${CRON_SECRET}" bekler, kullanıcı oturumu yok, bu
// yüzden RLS bypass eden admin client kullanılır). Döngünün kendisi (uygunluk
// taraması, executeAnalysis çağrısı, analysis_runs kayıt/güncelleme) dosya
// başına ~100 satır sınırı (CLAUDE.md) nedeniyle
// @/lib/analysis/run-cron-analysis-cycle.ts içine taşındı. vercel.json'da tek
// cron path'i olduğu için (bkz. docs/02-business-rules.md Bölüm G) plan/tier
// bağımsız günlük bakım (auto-dismiss taraması + haftalık özet e-postası)
// @/lib/analysis/run-daily-maintenance.ts üzerinden aynı tetiklemede çalışır.
export const maxDuration = 300;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  // Fail-closed: secret tanımsızsa endpoint hiçbir isteği kabul etmez —
  // yanlış yapılandırmayı 401 ile maskelemek yerine 500 ile görünür kıl.
  if (!cronSecret) {
    console.error("CRON_SECRET tanımlı değil — cron endpoint'i fail-closed kapalı.");
    return NextResponse.json({ error: "cron_secret_not_configured" }, { status: 500 });
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    assertProviderConfigured();
  } catch {
    return NextResponse.json({ error: "ai_provider_not_configured" }, { status: 502 });
  }

  const supabase = createAdminClient();
  const summary = await runCronAnalysisCycle(supabase);
  const maintenance = await runDailyMaintenance(supabase);

  return NextResponse.json({ ...summary, maintenance });
}
