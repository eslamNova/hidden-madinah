import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { languageAlternates, type Lang } from "@/lib/i18n";
import { getPlaceBySlug, getPublishedSlugs } from "@/lib/queries";
import { toTourSlides } from "@/lib/tour";
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

function resolvePlace(rawSlug: string, lang: Lang) {
  return getPlaceBySlug(decodeURIComponent(rawSlug), lang);
}

export async function placeTourMetadata(lang: Lang, params: Params): Promise<Metadata> {
  const { slug } = await params;
  const place = await resolvePlace(slug, lang);
  if (!place) return {};
  const t = await getTranslations("tour");
  return {
    title: t("placeTitle", { name: place.name_ar }),
    alternates: languageAlternates(`${placePath(place.slug)}/tour`, lang),
  };
}

export async function PlaceTourView({ lang, params }: { lang: Lang; params: Params }) {
  const { slug } = await params;
  const place = await resolvePlace(slug, lang);
  if (!place) notFound();

  return (
    <div className="-mb-28">
      <TourViewer slides={toTourSlides([place])} exitHref={placePath(place.slug)} />
    </div>
  );
}
