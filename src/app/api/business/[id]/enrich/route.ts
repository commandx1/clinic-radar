import { NextResponse } from "next/server";

import { enrichBusinessFromApify } from "@/lib/business/enrich-from-apify";
import { createClient } from "@/lib/supabase/server";

// Apify'ın run-sync-get-dataset-items çağrısı (bkz. src/lib/apify/client.ts,
// timeoutMs = 100_000) actor container'ı boot edip Google Maps crawl'ı bitirene
// kadar bekliyor — bu yüzden POST /api/business ve PATCH /api/business/:id'in
// insert/update yanıtını bloklamaması için ayrı bir isteğe çıkarıldı. Oluşturma
// (yeni işletme) ve place-değişimi (düzenleme) akışları bu endpoint'i paylaşır;
// client tarafı bu isteği kendi insert/update isteğinden SONRA, best-effort
// olarak tetikler (bkz. use-business-form.ts / business-save-steps.ts).
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    .select("id, google_place_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!business) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const enrichedBusiness = await enrichBusinessFromApify(supabase, business);

  return NextResponse.json({ business: enrichedBusiness }, { status: 200 });
}
