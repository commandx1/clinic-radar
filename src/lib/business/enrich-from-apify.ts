import { fetchPlaceDetails } from "@/lib/apify/google-places";
import { normalizeCategory } from "@/lib/category/normalize";
import { encodeGeohash } from "@/lib/geo/geohash";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Apify'dan işletmenin temel verisini (lat/lng/rating/kategori) çeker ve
// businesses satırını günceller — bkz. docs/04-api.md. Enrichment başarısız
// olursa çağıran satırı geri almaz; mevcut alanlar korunur ve verilen business
// objesi olduğu gibi döner. POST (oluşturma) ve PATCH (place değişimi) paylaşır.
export async function enrichBusinessFromApify<
  T extends { id: string; google_place_id: string | null },
>(supabase: SupabaseServerClient, business: T): Promise<T> {
  if (!business.google_place_id) {
    return business;
  }

  try {
    const details = await fetchPlaceDetails(business.google_place_id);
    if (!details) {
      return business;
    }

    // Güncellenen alanları tek yerde tut: hem DB'ye yaz hem de dönüş objesine
    // merge et. Böylece T'nin (çağıranın satır şekli) yerine DB'nin döndürdüğü
    // ham satıra bağımlı kalmıyoruz ve güvensiz `as T` cast'ine gerek kalmıyor.
    const patch = {
      lat: details.lat,
      lng: details.lng,
      geo_cell: encodeGeohash(details.lat, details.lng),
      rating: details.rating,
      review_count: details.review_count,
      category: details.category,
      normalized_category: normalizeCategory(details.category),
    };

    const { error: updateError } = await supabase
      .from("businesses")
      .update(patch)
      .eq("id", business.id);

    if (updateError) {
      console.error("Failed to persist business enrichment:", updateError);
      return business;
    }

    return { ...business, ...patch };
  } catch (apifyError) {
    console.error("Apify enrichment failed:", apifyError);
    return business;
  }
}
