import { NextResponse } from "next/server";

import { searchPlacesNearby, type PlaceCandidate } from "@/lib/apify/google-places";
import {
  CACHE_DENSE_ACTIVE_USER_THRESHOLD,
  CACHE_TTL_DENSE_DAYS,
  CACHE_TTL_SPARSE_DAYS,
  DISCOVERY_FETCH_BUFFER,
  DISCOVERY_MIN_REVIEWS_STEPS,
  DISCOVERY_RADIUS_KM_STEPS,
  DISCOVERY_TARGET_CANDIDATE_COUNT,
} from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

// Bölüm B keşif algoritması: yarıçap sırasıyla genişler (4→6→10km, sabit
// min-review eşiği 100 ile). Yeterli aday hâlâ bulunamazsa, en geniş
// yarıçaptaki aynı sonuç kümesi eşik düşürülerek (75→50) tekrar filtrelenir
// — ekstra Apify çağrısı yapılmaz (Apify'ın min-review-count parametresi yok,
// filtreleme her zaman uygulama kodunda).
async function discoverCandidates(business: {
  lat: number;
  lng: number;
  category: string;
}): Promise<{ candidates: PlaceCandidate[]; limited: boolean }> {
  let lastBatch: PlaceCandidate[] = [];

  for (const radiusKm of DISCOVERY_RADIUS_KM_STEPS) {
    lastBatch = await searchPlacesNearby({
      lat: business.lat,
      lng: business.lng,
      radiusKm,
      searchKeyword: business.category,
      maxResults: DISCOVERY_FETCH_BUFFER,
    });

    const filtered = lastBatch.filter((c) => (c.review_count ?? 0) >= DISCOVERY_MIN_REVIEWS_STEPS[0]);
    if (filtered.length >= DISCOVERY_TARGET_CANDIDATE_COUNT) {
      return { candidates: filtered, limited: false };
    }
  }

  let finalFiltered: PlaceCandidate[] = [];
  for (const minReviews of DISCOVERY_MIN_REVIEWS_STEPS.slice(1)) {
    finalFiltered = lastBatch.filter((c) => (c.review_count ?? 0) >= minReviews);
    if (finalFiltered.length >= DISCOVERY_TARGET_CANDIDATE_COUNT) {
      return { candidates: finalFiltered, limited: false };
    }
  }

  return { candidates: finalFiltered, limited: true };
}

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
    .select("id, google_place_id, lat, lng, geo_cell, category, normalized_category")
    .eq("id", id)
    .maybeSingle();

  if (!business) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (
    business.lat === null ||
    business.lng === null ||
    business.geo_cell === null ||
    business.normalized_category === null ||
    business.category === null
  ) {
    return NextResponse.json({ error: "business_not_enriched" }, { status: 422 });
  }

  try {
    const { data: cacheRow } = await supabase
      .from("region_category_cache")
      .select("candidates")
      .eq("normalized_category", business.normalized_category)
      .eq("geo_cell", business.geo_cell)
      .gt("ttl_expires_at", new Date().toISOString())
      .maybeSingle();

    let candidates: PlaceCandidate[];
    let limited: boolean;

    if (cacheRow) {
      candidates = cacheRow.candidates as unknown as PlaceCandidate[];
      limited = candidates.length < DISCOVERY_TARGET_CANDIDATE_COUNT;
    } else {
      const result = await discoverCandidates({
        lat: business.lat,
        lng: business.lng,
        category: business.category,
      });
      candidates = result.candidates;
      limited = result.limited;

      const { data: density } = await supabase.rpc("count_businesses_in_geo_cell", {
        target_geo_cell: business.geo_cell,
      });
      const ttlDays = (density ?? 0) < CACHE_DENSE_ACTIVE_USER_THRESHOLD ? CACHE_TTL_SPARSE_DAYS : CACHE_TTL_DENSE_DAYS;
      const ttlExpiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();

      const { error: upsertError } = await supabase.from("region_category_cache").upsert(
        {
          normalized_category: business.normalized_category,
          geo_cell: business.geo_cell,
          candidates: candidates as unknown as Json,
          fetched_at: new Date().toISOString(),
          ttl_expires_at: ttlExpiresAt,
        },
        { onConflict: "normalized_category,geo_cell" },
      );

      if (upsertError) {
        console.error("Failed to write region_category_cache:", upsertError);
      }
    }

    const visible = candidates
      .filter((c) => c.google_place_id !== business.google_place_id)
      .slice(0, DISCOVERY_TARGET_CANDIDATE_COUNT);

    return NextResponse.json({ candidates: visible, limited });
  } catch (discoverError) {
    console.error("Competitor discovery failed:", discoverError);
    return NextResponse.json({ error: "discover_failed" }, { status: 502 });
  }
}
