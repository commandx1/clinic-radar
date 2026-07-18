import { NextResponse } from "next/server";

import { searchPlacesByText, type SearchPlacesOptions } from "@/lib/google-places/search";
import { createClient } from "@/lib/supabase/server";

const LOCATION_BIAS_RADIUS_METERS = 50_000;

// Vercel'in edge/serverless fonksiyonlarına enjekte ettiği IP-bazlı konum
// header'ları. Sunucu (iad1/Ashburn) konumuna değil, isteği yapan kullanıcıya
// bias'lamak için kullanılır. Header'lar bozuk/eksik olabilir — Google'a
// sızmadan önce mutlaka valide et.
function buildLocationOptions(
  request: Request,
): Pick<SearchPlacesOptions, "locationBias" | "regionCode"> {
  const latParam = request.headers.get("x-vercel-ip-latitude");
  const lngParam = request.headers.get("x-vercel-ip-longitude");
  const countryParam = request.headers.get("x-vercel-ip-country");

  const latitude = latParam ? Number(latParam) : NaN;
  const longitude = lngParam ? Number(lngParam) : NaN;

  if (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  ) {
    return {
      locationBias: { latitude, longitude, radiusMeters: LOCATION_BIAS_RADIUS_METERS },
    };
  }

  // Sadece "TR", "US" gibi ISO 3166-1 alpha-2 kodlarına izin ver.
  if (countryParam && /^[A-Z]{2}$/.test(countryParam)) {
    return { regionCode: countryParam };
  }

  return {};
}

// İşletme arama combobox'ının backend'i (bkz. place-search-combobox.tsx).
// Auth zorunlu: key sunucuda kalır, anonim trafiğe Places kotası yakılmaz.
// q < 3 karakterse hiç Google'a gitmeden boş liste döner (debounce'un sunucu
// tarafı emniyeti).
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const langParam = url.searchParams.get("lang")?.trim() ?? "";
  // Sadece "tr", "en" gibi basit BCP-47 kodlarına izin ver — header injection
  // veya bozuk parametre Google'a sızmasın.
  const languageCode = /^[a-z]{2}(-[A-Z]{2})?$/.test(langParam) ? langParam : undefined;

  if (q.length < 3) {
    return NextResponse.json({ candidates: [] });
  }

  const searchOptions: SearchPlacesOptions = {
    ...(languageCode ? { languageCode } : {}),
    ...buildLocationOptions(request),
  };

  try {
    const candidates = await searchPlacesByText(q, searchOptions);
    return NextResponse.json({ candidates });
  } catch (error) {
    console.error("Places search failed:", error);
    return NextResponse.json({ error: "places_search_failed" }, { status: 502 });
  }
}
