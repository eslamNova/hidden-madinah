import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { coverImage, stripVerify } from "@/lib/content";
import { getPublishedPlaces } from "@/lib/queries";
import { MapView, type MapPin } from "@/components/map/MapView";

// Pins are static content — same 24h revalidate as the rest of the site.
// Fetching here (SSG) keeps supabase-js out of the map's client bundle and
// mounts the pins together with the map.
export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("map");
  return { title: t("title") };
}

export default async function MapPage() {
  const places = await getPublishedPlaces();

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
      <MapView pins={pins} />
    </div>
  );
}
