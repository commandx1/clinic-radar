import { NextResponse } from "next/server";
import { z } from "zod";

import { enrichBusinessFromApify } from "@/lib/business/enrich-from-apify";
import { createClient } from "@/lib/supabase/server";
import { updateBusinessSchema } from "@/lib/validations/business";

// İşletme düzenleme. Kullanıcının yanlış Google Place bağladığı ya da adı/
// mevcut aracı değiştirmek istediği durumlar için — bkz. docs/04-api.md.
// google_place_id değişirse lat/lng/rating yeniden Apify'dan zenginleştirilir.
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

  const { name, google_place_id, category, current_tool } = parsed.data;
  const placeChanged = google_place_id !== undefined && google_place_id !== existing.google_place_id;

  const { data: updated, error } = await supabase
    .from("businesses")
    .update({
      ...(name !== undefined && { name }),
      ...(google_place_id !== undefined && { google_place_id }),
      ...(category !== undefined && { category }),
      ...(current_tool !== undefined && { current_tool }),
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

  // Place değiştiyse konum/rating alanları eski işletmeye ait; yeniden çek.
  const business = placeChanged ? await enrichBusinessFromApify(supabase, updated) : updated;

  return NextResponse.json({ business });
}
