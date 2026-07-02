import { type NextRequest } from "next/server";

import { localeCookieName } from "@/i18n/locales";
import { resolveLocale } from "@/i18n/middleware";
import { updateSession } from "@/lib/supabase/middleware";

// NOT ADIYLA İLGİLİ ÖNEMLİ NOT: Next.js 16 dokümantasyonu bu dosyayı
// `proxy.ts` + `export function proxy(...)` olarak adlandırmayı öneriyor
// ("middleware" deprecated). Ancak bu proje Next.js 16.2.10'da `proxy.ts`
// hem dev hem production'da hiç çalışmadı (test edildi); `middleware.ts`
// (eski konvansiyon) ise production'da doğru çalışıyor (dev'de Turbopack
// bug'ı nedeniyle hiçbiri çalışmıyor, ayrıntı: proxy.ts denemesi sırasında
// doğrulandı). Next.js güncellendiğinde proxy.ts'e geçmeyi tekrar dene.
export async function middleware(request: NextRequest) {
  const locale = resolveLocale(request);
  const response = await updateSession(request);

  response.cookies.set(localeCookieName, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
