import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ExternalLink, Star } from "lucide-react";
import { stripVerify } from "@/lib/content";
import { CATEGORY_META, googleMapsUrl } from "@/lib/maps";
import { getPlaceBySlug, getPublishedSlugs } from "@/lib/queries";
import { CategoryIcon } from "@/components/CategoryIcon";
import { FeaturedQuote } from "@/components/place/FeaturedQuote";
import { Gallery } from "@/components/place/Gallery";
import { PlaceholderImage } from "@/components/place/PlaceImage";
import { RelatedPlaces } from "@/components/place/RelatedPlaces";
import { VisitInfoCard } from "@/components/place/VisitInfoCard";
import { PlaceMap } from "@/components/map/PlaceMap";

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
  const description = stripVerify(place.summary_ar) ?? undefined;
  const photo = place.media.find((m) => m.type === "photo");
  // Pre-generated 1600 JPEG fallback doubles as the OG image (Arabic-safe).
  const ogImage = photo ? photo.url.replace(/-1600\.webp$/, "-1600.jpg") : "/og-fallback.jpg";
  return {
    title: place.name_ar,
    description,
    alternates: { canonical: `/places/${encodeURIComponent(place.slug)}` },
    openGraph: {
      title: place.name_ar,
      description,
      images: [{ url: ogImage }],
      type: "article",
    },
  };
}

export default async function PlacePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const place = await resolvePlace(slug);
  if (!place) notFound();

  const t = await getTranslations("place");
  const tCommon = await getTranslations("common");
  const meta = CATEGORY_META[place.category];

  const summary = stripVerify(place.summary_ar);
  const story = stripVerify(place.story_ar);
  const virtue = stripVerify(place.virtue_ar);
  const tips = stripVerify(place.visiting_tips_ar);
  const quote = stripVerify(place.featured_quote_ar);
  const quoteSource = stripVerify(place.featured_quote_source_ar);
  const mapsUrl = googleMapsUrl(place);

  const lastUpdated = new Intl.DateTimeFormat("ar-SA-u-nu-latn-ca-gregory", {
    dateStyle: "long",
  }).format(new Date(place.last_updated));

  return (
    <article className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      {place.media.length > 0 ? (
        <Gallery media={place.media} placeName={place.name_ar} />
      ) : (
        <PlaceholderImage
          category={place.category}
          className="aspect-[4/3] w-full rounded-2xl"
        />
      )}

      <header className="space-y-3">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium text-basalt"
          style={{ backgroundColor: `${meta.color}1f` }}
        >
          <CategoryIcon category={place.category} className="h-4 w-4" />
          {meta.labelAr}
          {place.featured && (
            <Star aria-hidden="true" className="h-4 w-4 text-accent" fill="currentColor" />
          )}
        </span>
        <h1 className="text-4xl leading-snug">{place.name_ar}</h1>
        {summary && <p className="text-xl leading-relaxed text-muted">{summary}</p>}
      </header>

      {quote && <FeaturedQuote quote={quote} source={quoteSource} />}

      <VisitInfoCard place={place} />

      {story && (
        <section aria-label={t("story")} className="space-y-3">
          <h2 className="text-2xl">{t("story")}</h2>
          <p className="whitespace-pre-line text-lg leading-loose">{story}</p>
        </section>
      )}

      {virtue && (
        <section
          aria-label={t("virtue")}
          className="space-y-3 rounded-2xl border-s-4 border-primary bg-surface p-5"
        >
          <h2 className="text-2xl">{t("virtue")}</h2>
          <p className="text-lg leading-loose">{virtue}</p>
        </section>
      )}

      {tips && (
        <section aria-label={t("tips")} className="space-y-3">
          <h2 className="text-2xl">{t("tips")}</h2>
          <p className="whitespace-pre-line text-lg leading-loose">{tips}</p>
        </section>
      )}

      {place.lat != null && place.lng != null && (
        <section className="space-y-4">
          <PlaceMap
            lat={Number(place.lat)}
            lng={Number(place.lng)}
            nameAr={place.name_ar}
            color={meta.color}
          />
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-lg font-semibold text-surface"
            >
              <ExternalLink aria-hidden="true" className="h-5 w-5" />
              {t("openInMaps")}
            </a>
          )}
        </section>
      )}

      <RelatedPlaces slugs={place.related_place_slugs} />

      <footer className="border-t border-basalt/10 pt-4 text-base text-muted">
        {tCommon("lastUpdated", { date: lastUpdated })}
      </footer>
    </article>
  );
}