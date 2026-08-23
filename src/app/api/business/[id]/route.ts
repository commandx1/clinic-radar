import { NextResponse } from "next/server";
import { z } from "zod";

import { hasProAccess } from "@/lib/billing/plan-access";
import { normalizeTrustpilotDomainInput } from "@/lib/reviews/sources/trustpilot-domain";
import { createClient } from "@/lib/supabase/server";
import { updateBusinessSchema } from "@/lib/validations/business";

// İşletme düzenleme. Kullanıcının yanlış Google Place bağladığı ya da adı/
// mevcut aracı değiştirmek istediği durumlar için — bkz. docs/04-api.md.
// google_place_id değişirse lat/lng/rating yeniden zenginleştirilmesi gerekir,
// ama bu artık burada beklenmiyor (Apify çağrısı 100 saniyeye kadar sürebiliyor)
// — client, place değiştiğini fark edip PATCH başarılı döndükten sonra ayrı
// olarak POST /api/business/:id/enrich'i tetikler (bkz. business-save-steps.ts).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body: unknown = await request.json();
  const parsed = updateBusinessSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  // Sahiplik kontrolü: yalnızca kendi işletmesini düzenleyebilir.
  const { data: existing } = await supabase
    .from("businesses")
    .select("id, google_place_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { name, google_place_id, category, current_tool, trustpilot_domain_override } = parsed.data;

  // Trustpilot domain'inin elle düzeltilmesi Pro'ya özel (bkz. docs/02-business-rules.md
  // hibrit eşleme kararı). Doğrudan API isteğiyle bile Free/Pro-olmayan kullanıcı
  // bu alanı set edemez — client tarafındaki gizleme yeterli değil.
  let trustpilotDomainUpdate: { trustpilot_domain: string | null; trustpilot_checked_at: string } | null = null;
  if (trustpilot_domain_override !== undefined) {
    const { data: subscription } = await supabase
      .from("subscriptions")
      .select("plan, status, current_period_end")
      .eq("user_id", user.id)
      .maybeSingle();
    const isPro = hasProAccess(subscription);

    if (!isPro) {
      return NextResponse.json({ error: "pro_required" }, { status: 403 });
    }

    const trimmed = trustpilot_domain_override.trim();
    let normalizedDomain: string | null = null;
    if (trimmed !== "") {
      normalizedDomain = normalizeTrustpilotDomainInput(trimmed);
      if (normalizedDomain === null) {
        return NextResponse.json({ error: "invalid_trustpilot_domain" }, { status: 400 });
      }
    }

    // checked_at'i doldurmak, elle girilen (veya bilinçli olarak temizlenen)
    // değeri sonraki analiz döngülerindeki otomatik aramanın ezmesini engeller
    // (bkz. resolve-trustpilot-refs.ts).
    trustpilotDomainUpdate = { trustpilot_domain: normalizedDomain, trustpilot_checked_at: new Date().toISOString() };
  }

  const { data: updated, error } = await supabase
    .from("businesses")
    .update({
      ...(name !== undefined && { name }),
      ...(google_place_id !== undefined && { google_place_id }),
      ...(category !== undefined && { category }),
      ...(current_tool !== undefined && { current_tool }),
      ...trustpilotDomainUpdate,
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "already_linked" }, { status: 409 });
    }

    console.error("Failed to update business:", error);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ business: updated });
}
