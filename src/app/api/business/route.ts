import { NextResponse } from "next/server";
import { z } from "zod";

import { fetchPlaceDetails } from "@/lib/apify/google-places";
import { normalizeCategory } from "@/lib/category/normalize";
import { encodeGeohash } from "@/lib/geo/geohash";
import { createClient } from "@/lib/supabase/server";
import { createBusinessSchema } from "@/lib/validations/business";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body: unknown = await request.json();
  const parsed = createBusinessSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", details: z.treeifyError(parsed.error) },
      { status: 400 },
    );
  }

  const { data: existingBusiness } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingBusiness) {
    return NextResponse.json({ error: "business_already_exists" }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("businesses")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      google_place_id: parsed.data.google_place_id,
      category: parsed.data.category ?? null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      const errorCode = error.details.includes("user_id") ? "business_already_exists" : "already_linked";
      return NextResponse.json({ error: errorCode }, { status: 409 });
    }

    console.error("Failed to insert business:", error);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  const enrichedBusiness = await enrichBusinessFromApify(supabase, data);

  return NextResponse.json({ business: enrichedBusiness }, { status: 201 });
}

// Apify'dan işletmenin temel verisini (lat/lng/rating/kategori) çeker ve
// businesses satırını günceller — bkz. docs/04-api.md. Enrichment başarısız
// olursa business insert'i geri alınmaz; lat/lng null kalır, discover
// endpoint'i bunu "business_not_enriched" ile ele alır.
async function enrichBusinessFromApify(
  supabase: Awaited<ReturnType<typeof createClient>>,
  business: { id: string; google_place_id: string | null },
) {
  if (!business.google_place_id) {
    return business;
  }

  try {
    const details = await fetchPlaceDetails(business.google_place_id);
    if (!details) {
      return business;
    }

    const { data: updated, error: updateError } = await supabase
      .from("businesses")
      .update({
        lat: details.lat,
        lng: details.lng,
        geo_cell: encodeGeohash(details.lat, details.lng),
        rating: details.rating,
        review_count: details.review_count,
        category: details.category,
        normalized_category: normalizeCategory(details.category),
        last_scraped_at: new Date().toISOString(),
      })
      .eq("id", business.id)
      .select()
      .single();

    if (updateError) {
      console.error("Failed to persist business enrichment:", updateError);
      return business;
    }

    return updated;
  } catch (apifyError) {
    console.error("Apify enrichment failed:", apifyError);
    return business;
  }
}
