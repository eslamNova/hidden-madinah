import localFont from "next/font/local";

// Thmanyah typeface, self-hosted with written permission from thmanyah
// Publishing & Distribution (Khalid, 2026-09-08): self-hosting on our own
// server/CDN for rendering is licensed; publishing a direct download link or
// allowing hotlinking from other projects is not — see the CORS rule in
// next.config.ts. The files are shipped byte-for-byte: next/font/local does
// not subset local fonts, and the licence forbids modifying them (تعديل /
// تكييف), so no subsetting pass may ever be added here.
//
// One family for headings and body (the old Cairo/IBM Plex pair were both
// sans anyway); the serif display carries the wordmark, as Amiri did.
export const thmanyahSans = localFont({
  src: [
    { path: "../fonts/thmanyahsans-Regular.woff2", weight: "400", style: "normal" },
    { path: "../fonts/thmanyahsans-Medium.woff2", weight: "500", style: "normal" },
    { path: "../fonts/thmanyahsans-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-thmanyah-sans",
  display: "swap",
});

export const thmanyahSerif = localFont({
  src: [
    {
      path: "../fonts/thmanyahserifdisplay-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-thmanyah-serif",
  display: "swap",
  // Wordmark + featured quotes only — 80kB that should not race the hero
  // image on 4G, exactly as Amiri was treated before it.
  preload: false,
});
