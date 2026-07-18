import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

// bkz. docs/03-database.md businesses.analysis_stage, docs/04-api.md — UI
// "Analizi Çalıştır" mutation'ı pending iken bu endpoint'i kısa aralıklarla
// poll eder ve pipeline'ın gerçek aşamasını (scraping/themes/gap/tasks/
// summary/null) gösterir. Sadece işletme sahibi kendi businesses satırını
// okuyabilir (RLS zaten bunu zorunlu kılar), bu yüzden burada ek bir
// yetkilendirme kontrolü yapmıyoruz.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: business, error } = await supabase
    .from("businesses")
    .select("analysis_stage")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "stage_fetch_failed" }, { status: 500 });
  }

  if (!business) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({ stage: business.analysis_stage });
}
