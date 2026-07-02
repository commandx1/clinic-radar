import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { defaultLocale, isLocale, localeCookieName, type Locale } from "./locales";
import en from "../../messages/en.json";
import tr from "../../messages/tr.json";

const messagesByLocale: Record<Locale, Record<string, unknown>> = { tr, en };

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(localeCookieName)?.value;
  const locale = cookieValue && isLocale(cookieValue) ? cookieValue : defaultLocale;

  return {
    locale,
    messages: messagesByLocale[locale],
  };
});
