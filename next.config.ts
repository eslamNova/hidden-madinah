import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import withSerwistInit from "@serwist/next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  // The offline fallback document must be precached — the PrecacheFallbackPlugin
  // serves it from the precache. New revision per build refreshes it.
  additionalPrecacheEntries: [{ url: "/~offline", revision: crypto.randomUUID() }],
});

// Images are served straight from the pre-generated variant set (400/800/1600)
// by src/components/place/PlaceImage.tsx — no optimizer, no custom loader.
const nextConfig: NextConfig = {};

export default withSerwist(withNextIntl(nextConfig));
