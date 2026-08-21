import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPlaceBySlug, getPublishedSlugs } from "@/lib/queries";
import { toTourSlides } from "@/lib/tour";
import { TourViewer } from "@/components/tour/TourViewer";

export const revalidate = 86400;

export async function generateStaticParams() {
  const slugs = await getPublishedSlugs();
  return slugs.map((slug) => ({ slug }));
}

async function resolvePlace(rawSlug: string) {
  return getPlaceBySlug(decodeURIComponent(rawSlug));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const place = await resolvePlace(slug);
  if (!place) return {};
  const t = await getTranslations("tour");
  return { title: t("placeTitle", { name: place.name_ar }) };
}

/**
 * Per-place media tour — the same full-screen auto-playing viewer as /tour,
 * scoped to one place; exit returns to that place's page.
 */
export default async function PlaceTourPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const place = await resolvePlace(slug);
  if (!place) notFound();

  return (
    <div className="-mb-28">
      <TourViewer
        slides={toTourSlides([place])}
        exitHref={`/places/${encodeURIComponent(place.slug)}`}
      />
    </div>
  );
}
