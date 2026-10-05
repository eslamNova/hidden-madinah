import { getRequestConfig } from "next-intl/server";
import { INTL_LOCALE, type Lang } from "@/lib/i18n";

// The locale comes from setRequestLocale(), called by every layout and page
// (src/app/(ar) → "ar", src/app/(en) → "en"), so no request headers are read
// and pages stay static. Anything that doesn't set it (admin, API) is Arabic.
// "ar-u-nu-latn" pins Latin digits in Intl formatting: Node and browsers
// disagree on the default numbering system for "ar", which broke hydration on
// every page that renders a formatted count. Latin digits are also the site's
// existing convention (distances, prices, .ltr-nums).
export default getRequestConfig(async ({ requestLocale }) => {
  const lang: Lang = (await requestLocale) === "en" ? "en" : "ar";
  return {
    locale: INTL_LOCALE[lang],
    messages: (lang === "en" ? await import("../../messages/en.json") : await import("../../messages/ar.json")).default,
  };
});
