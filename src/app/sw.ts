import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  CacheFirst,
  ExpirationPlugin,
  Serwist,
  StaleWhileRevalidate,
} from "serwist";
import { defaultCache } from "@serwist/next/worker";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const DAY = 24 * 60 * 60;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // No skipWaiting: instant takeover let a new deploy purge the old build's
  // precached chunks under long-open tabs, breaking the next tap with a
  // ChunkLoadError. The new worker now activates on the next launch instead —
  // fine for a site whose content revalidates every 24h anyway.
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // OpenFreeMap glyphs (includes the Arabic font PBF ranges) — long-lived.
    {
      matcher: ({ url }) =>
        url.hostname === "tiles.openfreemap.org" && url.pathname.includes("/fonts/"),
      handler: new CacheFirst({
        cacheName: "ofm-glyphs",
        plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * DAY })],
      }),
    },
    // Style JSON + sprites — refresh in the background.
    {
      matcher: ({ url }) =>
        url.hostname === "tiles.openfreemap.org" &&
        (url.pathname.startsWith("/styles/") || url.pathname.includes("/sprites/")),
      handler: new StaleWhileRevalidate({ cacheName: "ofm-style" }),
    },
    // Vector tiles — cache-as-you-pan; the map is bounds-locked to Madinah so
    // every cached tile is a Madinah tile.
    {
      matcher: ({ url }) => url.hostname === "tiles.openfreemap.org",
      handler: new CacheFirst({
        cacheName: "ofm-tiles",
        plugins: [new ExpirationPlugin({ maxEntries: 600, maxAgeSeconds: 14 * DAY })],
      }),
    },
    // Supabase Storage images (not videos — range requests stay network-only).
    {
      matcher: ({ url }) =>
        url.pathname.includes("/storage/v1/object/public/media/") &&
        !url.pathname.endsWith(".mp4"),
      handler: new CacheFirst({
        cacheName: "media-images",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 300,
            maxAgeSeconds: 30 * DAY,
            maxAgeFrom: "last-used",
          }),
        ],
      }),
    },
    // Supabase REST reads (map pins fetched client-side).
    {
      matcher: ({ url }) => url.pathname.includes("/rest/v1/"),
      handler: new StaleWhileRevalidate({
        cacheName: "supabase-data",
        plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 7 * DAY })],
      }),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/~offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
