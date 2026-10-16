import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { getTranslations } from "next-intl/server";
import { ogImageOf } from "@/lib/article-format";
import { coverImage, stripVerify } from "@/lib/content";
import { haversineKm } from "@/lib/geo";
import { localizeHref, type Lang } from "@/lib/i18n";
import { pageMetadata, shareImageOf } from "@/lib/page-metadata";
import { getRouteSlugById, getRouteSlugs, getRouteWithStops } from "@/lib/queries";
import { jsonLdGraph, touristTripNode, wafaBookNode } from "@/lib/structured-data";
import { JsonLd } from "@/components/seo/JsonLd";
import { PageHero } from "@/components/layout/PageHero";
import { PlaceCard, toPlaceCardData } from "@/components/place/PlaceCard";
import type { RouteMapStop } from "@/components/map/RouteMap";
import { RouteMapLazy } from "@/components/map/LazyMaps";

/**
 * /routes/[slug] and /en/routes/[slug]. The route files set the request
 * locale before rendering. On English pages the route's display columns hold
 * English (title falls back to the Arabic; a description with no current
 * English is null and hidden) — see src/lib/i18n-content.ts.
 */

type Params = Promise<{ slug: string }>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const routePath = (slug: string) => `/routes/${encodeURIComponent(slug)}`;

export async function routeStaticParams() {
  const slugs = await getRouteSlugs();
  return slugs.map((slug) => ({ slug }));
}

// generateMetadata and the page read the same rows: once per request.
const load = cache((rawSlug: string, lang: Lang) => getRouteWithStops(decodeURIComponent(rawSlug), lang));

export async function routeMetadata(lang: Lang, params: Params): Promise<Metadata> {
  const { slug } = await params;
  const route = await load(slug, lang);
  if (!route) return {};
  // Route descriptions are owner content — strip [VERIFY] like place fields.
  return pageMetadata({
    lang,
    path: routePath(route.slug),
    title: route.title_ar,
    description: stripVerify(route.description_ar),
    image: shareImageOf(coverImage(route.stops.flatMap((s) => s.media)), route.title_ar),
  });
}

export async function RouteView({ lang, params }: { lang: Lang; params: Params }) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const route = await load(rawSlug, lang);
  if (!route) {
    // Routes used to be addressed by UUID — 308 old shared links to the slug,
    // in the language the link was opened in.
    if (UUID_RE.test(slug)) {
      const target = await getRouteSlugById(slug);
      if (target) permanentRedirect(localizeHref(routePath(target), lang));
    }
    notFound();
  }

  const t = await getTranslations("routes");
  const tCommon = await getTranslations("common");
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
  const cover = coverImage(route.stops.flatMap((s) => s.media));

  return (
    <>
      <PageHero
        photo={cover}
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
      {/* English is translated from the reviewed Arabic: say so before the
          reader meets it. */}
      {lang === "en" && (
        <p className="text-sm leading-relaxed text-muted">{tCommon("translationNote")}</p>
      )}

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
      <JsonLd
        data={jsonLdGraph(
          touristTripNode({
            lang,
            path: routePath(route.slug),
            name: route.title_ar,
            description,
            image: cover ? ogImageOf(cover) : null,
            stops: route.stops.map((s) => ({ name: s.name_ar, place: { slug: s.slug, category: s.category } })),
          }),
          wafaBookNode(lang)
        )}
      />
    </>
  );
}
