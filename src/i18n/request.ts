import { getRequestConfig } from "next-intl/server";

// Arabic-only for now; when English ships, resolve the locale from the
// request here and load the matching messages file.
export default getRequestConfig(async () => ({
  locale: "ar",
  messages: (await import("../../messages/ar.json")).default,
}));
