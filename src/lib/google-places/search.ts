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
  category: string | null;
}

interface PlacesTextSearchResponse {
  places?: {
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    rating?: number;
    userRatingCount?: number;
    primaryType?: string;
  }[];
}

// Kullanıcının IP konumuna göre bias — sunucu (Vercel) IP'sine değil, isteği
// yapan kullanıcıya yakın sonuçlar döner. Radius metre cinsinden.
export interface LocationBias {
  latitude: number;
  longitude: number;
  radiusMeters?: number;
}

export interface SearchPlacesOptions {
  languageCode?: string;
  // locationBias regionCode'dan önceliklidir — ikisi birden verilirse yalnızca
  // locationBias gönderilir (Places API'de aynı anda anlamsız çakışma olmasın diye).
  locationBias?: LocationBias;
  regionCode?: string;
}

interface PlacesTextSearchRequestBody {
  textQuery: string;
  pageSize: number;
  languageCode?: string;
  regionCode?: string;
  locationBias?: {
    circle: {
      center: { latitude: number; longitude: number };
      radius: number;
    };
  };
}

const DEFAULT_LOCATION_BIAS_RADIUS_METERS = 50_000;

export async function searchPlacesByText(
  query: string,
  options?: SearchPlacesOptions,
): Promise<PlaceSearchCandidate[]> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is not configured");
  }

  const requestBody: PlacesTextSearchRequestBody = {
    textQuery: query,
    pageSize: 6,
    ...(options?.languageCode ? { languageCode: options.languageCode } : {}),
  };

  if (options?.locationBias) {
    requestBody.locationBias = {
      circle: {
        center: {
          latitude: options.locationBias.latitude,
          longitude: options.locationBias.longitude,
        },
        radius: options.locationBias.radiusMeters ?? DEFAULT_LOCATION_BIAS_RADIUS_METERS,
      },
    };
  } else if (options?.regionCode) {
    requestBody.regionCode = options.regionCode;
  }

  const res = await fetch(PLACES_TEXT_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.primaryType",
    },
    body: JSON.stringify(requestBody),
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
      category: place.primaryType ?? null,
    }));
}
