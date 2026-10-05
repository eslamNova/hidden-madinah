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
const nextConfig: NextConfig = {
  // Two root layouts (src/app/(ar), src/app/(en)): URLs outside both get
  // src/app/global-not-found.tsx.
  experimental: { globalNotFound: true },
  async headers() {
    return [
      {
        // The Thmanyah licence permits self-hosting but forbids hotlinking
        // from other projects, and Vercel serves /_next/static with
        // `Access-Control-Allow-Origin: *` — which is exactly what makes
        // hotlinking possible. Narrowing it to our own origin closes that:
        // @font-face always fetches in CORS mode, so a third-party site
        // embedding these URLs is refused by the browser.
        //
        // Same-origin requests never consult CORS, so this is invisible to
        // our own pages — including preview deployments, which load their
        // own copies from their own origin.
        source: "/_next/static/media/:file*.woff2",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "https://www.mazarat-madinah.com" },
          { key: "Vary", value: "Origin" },
        ],
      },
    ];
  },
};

export default withSerwist(withNextIntl(nextConfig));
