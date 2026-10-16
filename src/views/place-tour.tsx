import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getTranslations } from "next-intl/server";
import { coverImage, stripVerify } from "@/lib/content";
import type { Lang } from "@/lib/i18n";
import { pageMetadata, shareImageOf } from "@/lib/page-metadata";
import { getPlaceBySlug, getPublishedSlugs } from "@/lib/queries";
import { jsonLdGraph } from "@/lib/structured-data";
import { tourVideoNodes, toTourSlides } from "@/lib/tour";
import { JsonLd } from "@/components/seo/JsonLd";
import { TourViewer } from "@/components/tour/TourViewer";

/**
 * /places/[slug]/tour and /en/places/[slug]/tour — the same full-screen
 * auto-playing viewer as /tour, scoped to one place; exit returns to that
 * place's page. The route files set the request locale before rendering.
 */

type Params = Promise<{ slug: string }>;

const placePath = (slug: string) => `/places/${encodeURIComponent(slug)}`;

export async function placeTourStaticParams() {
  const slugs = await getPublishedSlugs();
  return slugs.map((slug) => ({ slug }));
}

// generateMetadata and the page read the same rows: once per request.
const resolvePlace = cache((rawSlug: string, lang: Lang) => getPlaceBySlug(decodeURIComponent(rawSlug), lang));

/** Unique per place: the place's name and how many scenes its tour has. */
async function tourDescription(place: { name_ar: string }, scenes: number) {
  const t = await getTranslations("tour");
  return t("placeMetaDescription", { name: place.name_ar, count: scenes });
}

export async function placeTourMetadata(lang: Lang, params: Params): Promise<Metadata> {
  const { slug } = await params;
  const place = await resolvePlace(slug, lang);
  if (!place) return {};
  const t = await getTranslations("tour");
  const title = t("placeTitle", { name: place.name_ar });
  return pageMetadata({
    lang,
    path: `${placePath(place.slug)}/tour`,
    title,
    description: await tourDescription(place, toTourSlides([place]).length),
    image: shareImageOf(coverImage(place.media), title),
  });
}

export async function PlaceTourView({ lang, params }: { lang: Lang; params: Params }) {
  const { slug } = await params;
  const place = await resolvePlace(slug, lang);
  if (!place) notFound();
  const slides = toTourSlides([place]);
  const fallback = stripVerify(place.summary_ar) ?? (await tourDescription(place, slides.length));

  return (
    <div className="-mb-28">
      <TourViewer slides={slides} exitHref={placePath(place.slug)} />
      <JsonLd data={jsonLdGraph(...(await tourVideoNodes(slides, `${placePath(place.slug)}/tour`, lang, fallback)))} />
    </div>
  );
}
