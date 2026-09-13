import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ExternalLink, Play, Star } from "lucide-react";
import { coverImage, stripVerify, toPublicPlaceView } from "@/lib/content";
import { CATEGORY_META, googleMapsUrl } from "@/lib/maps";
import { variantUrl } from "@/lib/media-spec";
import { getPlaceBySlug, getPublishedSlugs } from "@/lib/queries";
import { CategoryIcon } from "@/components/CategoryIcon";
import { FeaturedQuote } from "@/components/place/FeaturedQuote";
import { Gallery } from "@/components/place/Gallery";
import { PlaceImage, PlaceholderImage } from "@/components/place/PlaceImage";
import { RelatedPlaces } from "@/components/place/RelatedPlaces";
import { SeerahAppCard } from "@/components/place/SeerahAppCard";
import { VisitInfoCard } from "@/components/place/VisitInfoCard";
import { PlaceMapLazy } from "@/components/map/LazyMaps";
import { TelegramIconLink } from "@/components/layout/TelegramIconLink";

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
  // Pre-generated 1600 JPEG fallback doubles as the OG image (Arabic-safe).
  // A video-only place falls back to its poster frame, which exists at 800 only.
  const cover = coverImage(place.media);
  const ogImage = !cover
    ? "/og-image.jpg"
    : cover.singleVariant
      ? cover.url
      : variantUrl(cover.url, 1600).replace(/\.webp$/, ".jpg");
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

  // Hero falls back to a video poster for video-only places. heroPhoto is
  // derived FROM the picked cover (not an independent predicate) so the
  // gallery drops exactly the row shown above and the alt text matches it;
  // a video whose poster is the hero stays in the gallery or it becomes
  // unplayable.
  const hero = coverImage(place.media);
  const heroPhoto =
    hero && !hero.singleVariant
      ? place.media.find((m) => m.type === "photo" && (m.thumb_url ?? m.url) === hero.url)
      : undefined;
  const galleryMedia = heroPhoto
    ? place.media.filter((m) => m !== heroPhoto)
    : place.media;

  return (
    <article className="space-y-8 pb-8">
      {/* Full-bleed hero: the photograph introduces the place, title over it. */}
      <header className="relative min-h-[62dvh] overflow-hidden bg-basalt">
        {hero ? (
          <PlaceImage
            media={hero}
            alt={stripVerify(heroPhoto?.caption_ar) ?? place.name_ar}
            sizes="100vw"
            priority
            capMobile
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

        {/* pt-24 below already reserves this band. */}
        <TelegramIconLink className="absolute end-2 top-[max(env(safe-area-inset-top),0.5rem)] z-10" />

        <div className="relative flex min-h-[62dvh] flex-col justify-end px-5 pb-8 pt-24">
          <div className="mx-auto w-full max-w-3xl space-y-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-basalt/60 px-3 py-1 text-sm font-medium backdrop-blur-sm">
              <CategoryIcon category={place.category} className="h-4 w-4 text-paper" />
              <span style={{ color: meta.tintOnDark }}>{meta.labelAr}</span>
              {place.featured && (
                <Star aria-hidden="true" className="h-4 w-4 text-accent" fill="currentColor" />
              )}
            </span>
            <h1 className="text-4xl leading-tight text-paper sm:text-5xl">
              {place.name_ar}
            </h1>
            {view.summary && (
              <p className="max-w-2xl text-xl leading-relaxed text-paper/85">{view.summary}</p>
            )}
            {place.media.length > 0 && (
              // Full-screen media tour for this place — same sheen CTA as
              // the landing; the inline gallery below stays as the quick look.
              <Link
                href={`/places/${encodeURIComponent(place.slug)}/tour`}
                className="tour-sheen press relative mt-2 inline-flex min-h-14 items-center gap-3 overflow-hidden rounded-2xl bg-paper px-6 text-lg font-semibold text-primary-dark shadow-lg"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary">
                  <Play aria-hidden="true" className="h-4 w-4 text-paper" fill="currentColor" />
                </span>
                {t("mediaTourCta", { count: place.media.length })}
              </Link>
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
            className="space-y-3 rounded-3xl border-s-4 border-brand bg-surface p-5 shadow-[0_1px_2px_rgba(46,46,51,0.05),0_16px_40px_-16px_rgba(46,46,51,0.18)]"
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
                className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-lg font-semibold text-paper"
              >
                <ExternalLink aria-hidden="true" className="h-5 w-5" />
                {t("openInMaps")}
              </a>
            )}
          </section>
        )}

        <SeerahAppCard />

        <RelatedPlaces slugs={view.relatedSlugs} />

        <footer className="border-t border-ink/10 pt-4 text-base text-muted">
          {tCommon("lastUpdated", { date: lastUpdated })}
        </footer>
      </div>
    </article>
  );
}