import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";
import { getLocale } from "next-intl/server";

import { loadMonthlyReportData } from "@/lib/reports/monthly-report-data";
import { MonthlyReportDocument } from "@/lib/reports/monthly-report-document";
import { buildMonthlyReportStrings } from "@/lib/reports/monthly-report-strings";
import { createClient } from "@/lib/supabase/server";

// bkz. docs/10-roadmap.md Faz 2 — aylık özet dışa aktarımı. Kullanıcının
// oturumuyla (RLS) çalışır, kendi işletmesi dışındaki bir business_id'ye
// erişim `.eq("user_id", user.id)` filtresiyle 404'e düşer.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!business) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const locale = await getLocale();
  const reportLocale = locale === "tr" ? "tr" : "en";
  const data = await loadMonthlyReportData(supabase, business.id, business.name, reportLocale);
  const strings = buildMonthlyReportStrings(reportLocale);
  const pdfBuffer = await renderToBuffer(MonthlyReportDocument({ data, strings }));

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="clinicradar-monthly-report.pdf"`,
    },
  });
}
