import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ExternalLink, Star } from "lucide-react";
import { stripVerify, toPublicPlaceView } from "@/lib/content";
import { CATEGORY_META, googleMapsUrl } from "@/lib/maps";
import { getPlaceBySlug, getPublishedSlugs } from "@/lib/queries";
import { CategoryIcon } from "@/components/CategoryIcon";
import { FeaturedQuote } from "@/components/place/FeaturedQuote";
import { Gallery } from "@/components/place/Gallery";
import { PlaceImage, PlaceholderImage } from "@/components/place/PlaceImage";
import { RelatedPlaces } from "@/components/place/RelatedPlaces";
import { VisitInfoCard } from "@/components/place/VisitInfoCard";
import { PlaceMapLazy } from "@/components/map/LazyMaps";

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

  // Everything below renders from the sanitized view only — the raw row (with
  // [VERIFY] markers and owner notes) never crosses into the rendered tree.
  const view = toPublicPlaceView(place, googleMapsUrl(place));

  const lastUpdated = new Intl.DateTimeFormat("ar-SA-u-nu-latn-ca-gregory", {
    dateStyle: "long",
  }).format(new Date(view.lastUpdated));

  const heroPhoto = place.media.find((m) => m.type === "photo");
  const galleryMedia = place.media.filter((m) => m !== heroPhoto);

  return (
    <article className="space-y-8 pb-8">
      {/* Full-bleed hero: the photograph introduces the place, title over it. */}
      <header className="relative min-h-[62dvh] overflow-hidden bg-basalt">
        {heroPhoto ? (
          <PlaceImage
            media={heroPhoto}
            alt={heroPhoto.caption_ar ?? place.name_ar}
            sizes="100vw"
            priority
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <PlaceholderImage
            category={place.category}
            className="absolute inset-0 h-full w-full"
            iconClassName="h-24 w-24"
          />
        )}
        <div aria-hidden="true" className="warm-wash absolute inset-0" />
        <div aria-hidden="true" className="scrim-hero absolute inset-0" />

        <div className="relative flex min-h-[62dvh] flex-col justify-end px-5 pb-8 pt-24">
          <div className="mx-auto w-full max-w-3xl space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-basalt/60 px-3 py-1 text-sm font-medium backdrop-blur-sm">
              <CategoryIcon category={place.category} className="h-4 w-4 text-surface" />
              <span style={{ color: meta.tintOnDark }}>{meta.labelAr}</span>
              {place.featured && (
                <Star aria-hidden="true" className="h-4 w-4 text-accent" fill="currentColor" />
              )}
            </span>
            <h1 className="text-4xl leading-tight text-surface sm:text-5xl">
              {place.name_ar}
            </h1>
            {view.summary && (
              <p className="max-w-2xl text-xl leading-relaxed text-surface/85">{view.summary}</p>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-8 px-4">
        {view.quote && <FeaturedQuote quote={view.quote} source={view.quoteSource} />}

        <VisitInfoCard place={view} />

        {galleryMedia.length > 0 && (
          <section aria-label={t("gallery")} className="space-y-3">
            <h2 className="text-2xl">{t("gallery")}</h2>
            <Gallery media={galleryMedia} placeName={place.name_ar} />
          </section>
        )}

        {view.story && (
          <section aria-label={t("story")} className="space-y-3">
            <h2 className="text-2xl">{t("story")}</h2>
            <span aria-hidden="true" className="gold-rule block h-px w-16" />
            <p className="whitespace-pre-line text-lg leading-loose">{view.story}</p>
          </section>
        )}

        {view.virtue && (
          <section
            aria-label={t("virtue")}
            className="space-y-3 rounded-2xl border-s-4 border-primary bg-surface p-5"
          >
            <h2 className="text-2xl">{t("virtue")}</h2>
            <p className="text-lg leading-loose">{view.virtue}</p>
          </section>
        )}

        {view.tips && (
          <section aria-label={t("tips")} className="space-y-3">
            <h2 className="text-2xl">{t("tips")}</h2>
            <span aria-hidden="true" className="gold-rule block h-px w-16" />
            <p className="whitespace-pre-line text-lg leading-loose">{view.tips}</p>
          </section>
        )}

        {view.lat != null && view.lng != null && (
          <section className="space-y-4">
            <PlaceMapLazy
              lat={view.lat}
              lng={view.lng}
              nameAr={place.name_ar}
              color={meta.color}
            />
            {view.mapsUrl && (
              <a
                href={view.mapsUrl}
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

        <RelatedPlaces slugs={view.relatedSlugs} />

        <footer className="border-t border-basalt/10 pt-4 text-base text-muted">
          {tCommon("lastUpdated", { date: lastUpdated })}
        </footer>
      </div>
    </article>
  );
}