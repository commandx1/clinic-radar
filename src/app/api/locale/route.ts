import { NextResponse } from "next/server";

import { isLocale, localeCookieName } from "@/i18n/locales";
import { createClient } from "@/lib/supabase/server";

// Test amaçlı basit dil değiştirici — bkz. docs/07-ui.md (manuel değiştirme
// Faz 1.1'e bırakılmıştı, mekanizma zaten hazır olduğu için erken eklendi).
// auth/signout/route.ts ile aynı desen: form POST + redirect.
// Referer'dan dönüş hedefi türetirken open redirect'e izin verme: yalnızca
// aynı origin'e ait path'ler kabul edilir, aksi halde /business'a dönülür.
function safeRedirectTarget(referer: string | null, requestUrl: string): URL {
  const fallback = new URL("/business", requestUrl);
  if (!referer) {
    return fallback;
  }
  try {
    const target = new URL(referer);
    if (target.origin !== new URL(requestUrl).origin) {
      return fallback;
    }
    return new URL(target.pathname + target.search, requestUrl);
  } catch {
    return fallback;
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const locale = url.searchParams.get("locale");
  const referer = request.headers.get("referer");
  const response = NextResponse.redirect(safeRedirectTarget(referer, request.url));

  if (locale && isLocale(locale)) {
    response.cookies.set(localeCookieName, locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });

    // Seçimi kalıcılaştır: cron e-postaları (haftalık özet, aylık rapor)
    // çerezi göremediği için `users.preferred_locale` sütununu okur.
    // Oturum yoksa (login sayfasındaki değiştirici) sessizce atlanır;
    // yazım hatası da dil değiştirmeyi engellememeli.
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase
          .from("users")
          .update({ preferred_locale: locale })
          .eq("id", user.id);
        if (error) {
          console.error("preferred_locale güncellenemedi:", error);
        }
      }
    } catch (err) {
      console.error("preferred_locale güncellenemedi:", err);
    }
  }

  return response;
}
