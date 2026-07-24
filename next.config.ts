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

const nextConfig: NextConfig = {
  images: {
    // Supabase free tier has no image transformations; variants are
    // pre-generated at 400/800/1600 and the loader snaps to the nearest one.
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
    deviceSizes: [400, 800, 1600],
  },
};

export default withSerwist(withNextIntl(nextConfig));
