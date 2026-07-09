import { timingSafeEqual } from "node:crypto";

import { after, NextResponse } from "next/server";

import { assertProviderConfigured } from "@/lib/ai-pipeline/provider";
import { runCronAnalysisCycle } from "@/lib/analysis/run-cron-analysis-cycle";
import { runDailyMaintenance } from "@/lib/analysis/run-daily-maintenance";
import { createAdminClient } from "@/lib/supabase/admin";

// Runaway self-chain'e karşı sabit üst sınır: her invocation en az bir işletme
// işlediği ve uygunluk sorgusu (last_scraped_at güncellenerek) kümeyi
// küçülttüğü için pratikte çok daha erken durur; bu yalnızca son güvenlik ağı.
const MAX_SELF_CHAIN = 40;

// İki string'i uzunluk sızıntısı olmadan sabit sürede karşılaştır — Bearer
// token doğrulamasında zamanlama saldırısını (early-exit) engeller.
function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

// Self-chain hedef URL'i. Vercel prod deployment URL'i otomatik sağlanır;
// CRON_SELF_BASE_URL ile override edilebilir. Yoksa self-chain devre dışı kalır
// ve döngü tek pencerede (300s) işlenebildiği kadarıyla sınırlı olur.
function getSelfBaseUrl(): string | null {
  if (process.env.CRON_SELF_BASE_URL) {
    return process.env.CRON_SELF_BASE_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return null;
}

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

  const authHeader = request.headers.get("authorization") ?? "";
  if (!timingSafeStringEqual(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    assertProviderConfigured();
  } catch {
    return NextResponse.json({ error: "ai_provider_not_configured" }, { status: 502 });
  }

  const chain = Number.parseInt(new URL(request.url).searchParams.get("_chain") ?? "0", 10) || 0;

  const supabase = createAdminClient();
  const summary = await runCronAnalysisCycle(supabase);

  // Günlük bakım (auto-dismiss + haftalık özet e-postası) yalnızca zincirin ilk
  // (Vercel Cron tetikli) invocation'ında çalışır; self-chain devamlarında
  // tekrar çalıştırmak gereksiz e-posta/DB taraması üretir.
  const maintenance = chain === 0 ? await runDailyMaintenance(supabase) : null;

  // Zaman bütçesi tükendiği için işlenemeyen işletme kaldıysa kendini yeniden
  // tetikle. Vercel Hobby cron günde yalnızca 1 kez tetiklendiğinden, kuyruğun
  // aynı gün içinde boşaltılması için self-chain gerekir. after() yanıt
  // gönderildikten sonra çalışır, böylece fetch serverless dondurmasından
  // etkilenmez. baseUrl yoksa (yapılandırılmamışsa) tek pencereyle sınırlı kalır.
  const baseUrl = getSelfBaseUrl();
  if (summary.remaining > 0 && baseUrl && chain < MAX_SELF_CHAIN) {
    after(async () => {
      try {
        await fetch(`${baseUrl}/api/cron/weekly-analysis?_chain=${String(chain + 1)}`, {
          headers: { authorization: `Bearer ${cronSecret}` },
        });
      } catch (err) {
        console.error("Cron self-chain tetiklemesi başarısız:", err);
      }
    });
  }

  return NextResponse.json({ ...summary, maintenance, chain });
}
