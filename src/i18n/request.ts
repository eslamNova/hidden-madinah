import { getRequestConfig } from "next-intl/server";

// Arabic-only for now; when English ships, resolve the locale from the
// request here and load the matching messages file.
// -u-nu-latn pins Latin digits in Intl formatting: Node and browsers disagree
// on the default numbering system for "ar", which broke hydration on every
// page that renders a formatted count. Latin digits are also the site's
// existing convention (distances, prices, .ltr-nums).
export default getRequestConfig(async () => ({
  locale: "ar-u-nu-latn",
  messages: (await import("../../messages/ar.json")).default,
}));
