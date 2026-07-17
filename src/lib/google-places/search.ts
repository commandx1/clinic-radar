// Google Places API (New) Text Search — interaktif işletme araması için.
// Apify (src/lib/apify/google-places.ts) batch/scrape işlerinde kalır; bu dosya
// sadece onboarding/edit formundaki "yazdıkça ara" akışını besler (<1sn yanıt).
// ToS notu: buradan dönen alanlar yalnızca seçim UI'ında gösterilir; kalıcı
// saklanan tek şey google_place_id'dir (detaylar Apify enrichment'tan gelir).

const PLACES_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";

// Combobox'ta bir aday satırını çizmeye yetecek minimum alan seti. FieldMask
// bu listeyle senkron tutulmalı — fazladan alan istemek SKU maliyetini artırır.
export interface PlaceSearchCandidate {
  google_place_id: string;
  name: string;
  address: string | null;
  rating: number | null;
  review_count: number | null;
}

interface PlacesTextSearchResponse {
  places?: {
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    rating?: number;
    userRatingCount?: number;
  }[];
}

export async function searchPlacesByText(
  query: string,
  languageCode?: string,
): Promise<PlaceSearchCandidate[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is not configured");
  }

  const res = await fetch(PLACES_TEXT_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount",
    },
    body: JSON.stringify({
      textQuery: query,
      pageSize: 6,
      ...(languageCode ? { languageCode } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`places_text_search_failed_${String(res.status)}: ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as PlacesTextSearchResponse;

  return (data.places ?? [])
    .filter((place): place is typeof place & { id: string } => Boolean(place.id))
    .map((place) => ({
      google_place_id: place.id,
      name: place.displayName?.text ?? "",
      address: place.formattedAddress ?? null,
      rating: place.rating ?? null,
      review_count: place.userRatingCount ?? null,
    }));
}
