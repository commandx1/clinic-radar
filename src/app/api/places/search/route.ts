import { NextResponse } from "next/server";

import { searchPlacesByText } from "@/lib/google-places/search";
import { createClient } from "@/lib/supabase/server";

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

  try {
    const candidates = await searchPlacesByText(q, languageCode);
    return NextResponse.json({ candidates });
  } catch (error) {
    console.error("Places search failed:", error);
    return NextResponse.json({ error: "places_search_failed" }, { status: 502 });
  }
}
