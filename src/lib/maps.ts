import type { Enums, Tables } from "@/lib/database.types";

export type PlaceCategory = Enums<"place_category">;

/**
 * Category display metadata. `icon` is a lucide-react icon name resolved in
 * components; `color` is the map-pin/badge color (calm, heritage-adjacent —
 * gold stays decorative and is never used as a category color).
 * `tintOnDark` is the same hue lifted for legibility on photo scrims.
 *
 * `labelAr`/`pluralAr` serve the Arabic-only admin. Public pages show the
 * labels from messages (places.category.<cat> / places.categoryPlural.<cat>),
 * so they follow the page's language.
 */
export const CATEGORY_META: Record<
  PlaceCategory,
  {
    labelAr: string;
    pluralAr: string;
    color: string;
    tintOnDark: string;
    icon: "landmark" | "droplets" | "trees" | "castle" | "map-pin";
  }
> = {
  mosque: {
    labelAr: "مسجد أثري",
    pluralAr: "مساجد أثرية",
    color: "#1F5C3D",
    tintOnDark: "#8FD3AC",
    icon: "landmark",
  },
  well: {
    labelAr: "بئر",
    pluralAr: "آبار",
    color: "#33628C",
    tintOnDark: "#9CC6EE",
    icon: "droplets",
  },
  garden: {
    labelAr: "بستان",
    pluralAr: "بساتين",
    color: "#5B8A3C",
    tintOnDark: "#B6DC8E",
    icon: "trees",
  },
  historical_site: {
    labelAr: "موقع تاريخي",
    pluralAr: "مواقع تاريخية",
    color: "#7A5C3E",
    tintOnDark: "#DFBE97",
    icon: "castle",
  },
  other: {
    labelAr: "مكان",
    pluralAr: "أماكن أخرى",
    color: "#615B4E",
    tintOnDark: "#CFC7B6",
    icon: "map-pin",
  },
};

export const CATEGORY_ORDER: PlaceCategory[] = [
  "mosque",
  "well",
  "garden",
  "historical_site",
  "other",
];

/**
 * Link for "افتح في الخرائط": the owner's shared Google Maps URL when
 * available, otherwise a coordinates search link.
 */
export function googleMapsUrl(
  place: Pick<Tables<"places">, "google_maps_url" | "lat" | "lng">
): string | null {
  if (place.google_maps_url) return place.google_maps_url;
  if (place.lat != null && place.lng != null) {
    return `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
  }
  return null;
}

/** OpenFreeMap style — free vector tiles, no API key. */
export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

/** OpenFreeMap styles per theme (both token-free, both carry Arabic names). */
export const MAP_STYLE_URLS = {
  light: MAP_STYLE_URL,
  dark: "https://tiles.openfreemap.org/styles/dark",
} as const;

export function mapStyleUrl(theme: "light" | "dark"): string {
  return MAP_STYLE_URLS[theme];
}

/** Self-hosted RTL text plugin (public/) so Arabic labels shape correctly offline. */
export const RTL_TEXT_PLUGIN_URL = "/mapbox-gl-rtl-text.js";
