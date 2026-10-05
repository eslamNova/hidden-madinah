import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { coverImage, stripVerify } from "@/lib/content";
import { haversineKm } from "@/lib/geo";
import { getRouteSlugById, getRouteSlugs, getRouteWithStops } from "@/lib/queries";
import { PageHero } from "@/components/layout/PageHero";
import { PlaceCard, toPlaceCardData } from "@/components/place/PlaceCard";
import type { RouteMapStop } from "@/components/map/RouteMap";
import { RouteMapLazy } from "@/components/map/LazyMaps";

export const revalidate = 86400;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateStaticParams() {
  const slugs = await getRouteSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const route = await getRouteWithStops(decodeURIComponent(slug));
  // Route descriptions are owner content — strip [VERIFY] like place fields.
  return route
    ? { title: route.title_ar, description: stripVerify(route.description_ar) ?? undefined }
    : {};
}

export default async function RouteDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const route = await getRouteWithStops(slug);
  if (!route) {
    // Routes used to be addressed by UUID — 308 old shared links to the slug.
    if (UUID_RE.test(slug)) {
      const target = await getRouteSlugById(slug);
      if (target) permanentRedirect(`/routes/${encodeURIComponent(target)}`);
    }
    notFound();
  }

  const t = await getTranslations("routes");
  const description = stripVerify(route.description_ar);

  const mapStops: RouteMapStop[] = route.stops
    .filter((s) => s.lat != null && s.lng != null)
    .map((s) => ({
      lat: Number(s.lat),
      lng: Number(s.lng),
      nameAr: s.name_ar,
      slug: s.slug,
    }));

  let totalKm = 0;
  for (let i = 1; i < mapStops.length; i++) {
    totalKm += haversineKm(mapStops[i - 1], mapStops[i]);
  }
  totalKm = Math.round(totalKm * 10) / 10;

  return (
    <>
      <PageHero
        photo={coverImage(route.stops.flatMap((s) => s.media))}
        category={route.stops[0]?.category}
        title={route.title_ar}
        subtitle={description}
      >
        <p className="font-medium text-paper/90">
          {t("stopsCount", { count: route.stops.length })}
          {mapStops.length >= 2 && (
            <>
              {" · "}
              <span className="ltr-nums">{t("totalDistance", { km: totalKm })}</span>
            </>
          )}
        </p>
      </PageHero>
      <div className="mx-auto max-w-3xl space-y-8 px-4 pb-8 pt-8">
      {mapStops.length >= 2 && <RouteMapLazy stops={mapStops} />}

      <ol className="space-y-6">
        {route.stops.map((stop, i) => (
          <li key={stop.slug} className="relative">
            <div className="mb-2 flex items-center gap-3">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-paper"
              >
                {i + 1}
              </span>
              <span className="text-lg font-semibold text-muted">
                {t("stopLabel", { n: i + 1 })}
              </span>
            </div>
            <PlaceCard place={toPlaceCardData(stop)} compact />
          </li>
        ))}
      </ol>
      </div>
    </>
  );
}