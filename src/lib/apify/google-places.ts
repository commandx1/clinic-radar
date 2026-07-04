import { runActorSync } from "@/lib/apify/client";

// Apify'a özgü alan adları burada izole edilir — actor'ün ham şeması
// değişirse sadece bu dosya güncellenir (bkz. docs/04-api.md, Apify Google
// Maps Scraper: compass/crawler-google-places).
const GOOGLE_PLACES_ACTOR_ID = "compass/crawler-google-places";

interface ApifyPlaceItem {
  placeId: string;
  title: string;
  totalScore: number | null;
  reviewsCount: number | null;
  categoryName: string | null;
  location: { lat: number; lng: number } | null;
}

export interface PlaceCandidate {
  google_place_id: string;
  name: string;
  rating: number | null;
  review_count: number | null;
}

export interface PlaceDetails extends PlaceCandidate {
  category: string | null;
  lat: number;
  lng: number;
}

function toCandidate(item: ApifyPlaceItem): PlaceCandidate {
  return {
    google_place_id: item.placeId,
    name: item.title,
    rating: item.totalScore,
    review_count: item.reviewsCount,
  };
}

export async function searchPlacesNearby(params: {
  lat: number;
  lng: number;
  radiusKm: number;
  searchKeyword: string;
  maxResults: number;
}): Promise<PlaceCandidate[]> {
  const items = await runActorSync<ApifyPlaceItem>(GOOGLE_PLACES_ACTOR_ID, {
    searchStringsArray: [params.searchKeyword],
    customGeolocation: {
      type: "Point",
      coordinates: [params.lng, params.lat],
      radiusKm: params.radiusKm,
    },
    maxCrawledPlacesPerSearch: params.maxResults,
  });

  return items.map(toCandidate);
}

export async function fetchPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  const items = await runActorSync<ApifyPlaceItem>(GOOGLE_PLACES_ACTOR_ID, {
    placeIds: [placeId],
    maxCrawledPlacesPerSearch: 1,
  });

  if (items.length === 0) {
    return null;
  }

  const item = items[0];
  if (!item.location) {
    return null;
  }

  return {
    ...toCandidate(item),
    category: item.categoryName,
    lat: item.location.lat,
    lng: item.location.lng,
  };
}
