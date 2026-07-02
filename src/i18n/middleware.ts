import type { NextRequest } from "next/server";

import { defaultLocale, isLocale, localeCookieName, type Locale } from "./locales";

function pickLocaleFromAcceptLanguage(header: string | null): Locale {
  if (!header) {
    return defaultLocale;
  }

  const preferred = header
    .split(",")
    .map((part) => part.trim().split(";")[0]?.toLowerCase())
    .filter((tag): tag is string => Boolean(tag));

  for (const tag of preferred) {
    const base = tag.split("-")[0];
    if (base && isLocale(base)) {
      return base;
    }
  }

  return defaultLocale;
}

// Cihaz dili (Accept-Language) ilk ziyarette bir kere okunur. request.cookies
// üzerine yazılır ki bu İSTEĞİN kendi server-side render'ı da (cookies() ile
// okunan) doğru locale'i görsün — sadece response'a yazmak bir sonraki
// isteğe kadar etkisiz kalırdı. Çağıran taraf dönen locale'i response'a da
// kopyalamalı (tarayıcının kalıcı olarak saklaması için).
export function resolveLocale(request: NextRequest): Locale {
  const existing = request.cookies.get(localeCookieName)?.value;
  if (existing && isLocale(existing)) {
    return existing;
  }

  const locale = pickLocaleFromAcceptLanguage(request.headers.get("accept-language"));
  request.cookies.set(localeCookieName, locale);
  return locale;
}
