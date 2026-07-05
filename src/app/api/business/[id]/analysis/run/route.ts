import { NextResponse } from "next/server";
import { getLocale } from "next-intl/server";

import { assertProviderConfigured } from "@/lib/ai-pipeline/provider";
import { runManualAnalysisForBusiness } from "@/lib/analysis/run-manual-analysis";
import { createClient } from "@/lib/supabase/server";

// Bkz. docs/04-api.md: Faz 1'de senkron çalışır (job/queue altyapısı yok,
// mevcut tüm Apify çağrılarıyla aynı desen). Own + rakipler tek batch Apify
// çağrısıyla çekilir, ardından Claude Aşama 1 (own + her rakip paralel),
// Aşama 2 ve Aşama 3 (executive summary, snapshot yazımından hemen önce) aynı
// istek içinde çalışır — bu yüzden maxDuration Apify + Claude fazlarının
// toplamını karşılayacak şekilde yükseltildi (deploy platformunun buna
// gerçekten izin verdiği doğrulanmalı). İş kuralları (cooldown, uygunluk,
// run kaydı) dosya başına ~100 satır sınırı (CLAUDE.md) nedeniyle
// @/lib/analysis/run-manual-analysis.ts içine taşındı.
export const maxDuration = 450;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    assertProviderConfigured();
  } catch {
    return NextResponse.json({ error: "ai_provider_not_configured" }, { status: 502 });
  }

  const outputLanguage = await getLocale();
  const { status, body } = await runManualAnalysisForBusiness(supabase, id, user.id, outputLanguage);

  return NextResponse.json(body, { status });
}
