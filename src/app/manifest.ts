import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: "مزارات المدينة",
    description: SITE_DESCRIPTION,
    id: "/",
    start_url: "/",
    display: "standalone",
    dir: "rtl",
    lang: "ar",
    // Dark is the app's default theme — the splash must not flash sand.
    background_color: "#141418",
    theme_color: "#1f5c3d",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
