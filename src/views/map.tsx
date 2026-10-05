import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { coverImage, stripVerify } from "@/lib/content";
import { languageAlternates, type Lang } from "@/lib/i18n";
import { getPublishedPlaces } from "@/lib/queries";
import { MapView as PlacesMap, type MapPin } from "@/components/map/MapView";

/**
 * /map and /en/map. The route files set the request locale before rendering.
 * Pins are static content fetched here (SSG), which keeps supabase-js out of
 * the map's client bundle and mounts the pins together with the map.
 */
export async function mapMetadata(lang: Lang): Promise<Metadata> {
  const t = await getTranslations("map");
  return { title: t("title"), alternates: languageAlternates("/map", lang) };
}

export async function MapView({ lang }: { lang: Lang }) {
  const places = await getPublishedPlaces(lang);

  const pins: MapPin[] = places
    .filter((p) => p.lat != null && p.lng != null)
    .map((p) => ({
      lat: Number(p.lat),
      lng: Number(p.lng),
      place: {
        slug: p.slug,
        name_ar: p.name_ar,
        category: p.category,
        summary: stripVerify(p.summary_ar),
        distanceKm:
          p.distance_from_prophets_mosque_km != null
            ? Number(p.distance_from_prophets_mosque_km)
            : null,
        thumb: coverImage(p.media),
      },
    }));

  // Full-bleed map: cancel the root layout's bottom padding.
  return (
    <div className="-mb-28">
      <PlacesMap pins={pins} />
    </div>
  );
}
