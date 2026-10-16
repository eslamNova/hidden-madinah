import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getTranslations } from "next-intl/server";
import Link from "@/components/i18n/Link";
import { ExternalLink, Play, Star } from "lucide-react";
import { coverImage, stripVerify, toPublicPlaceView } from "@/lib/content";
import { INTL_LOCALE, type Lang } from "@/lib/i18n";
import { localizePlace } from "@/lib/i18n-content";
import { CATEGORY_META, googleMapsUrl } from "@/lib/maps";
import { pageMetadata, shareImageOf } from "@/lib/page-metadata";
import { getPlaceBySlug, getPlaceClaims, getPublishedSlugs } from "@/lib/queries";
import { breadcrumbNode, jsonLdGraph, placeImageUrls, placeNode } from "@/lib/structured-data";
import { JsonLd } from "@/components/seo/JsonLd";
import { WafaClaims } from "@/components/place/WafaClaims";
import { CategoryIcon } from "@/components/CategoryIcon";
import { FeaturedQuote } from "@/components/place/FeaturedQuote";
import { Gallery } from "@/components/place/Gallery";
import { PlaceImage, PlaceholderImage } from "@/components/place/PlaceImage";
import { RelatedPlaces } from "@/components/place/RelatedPlaces";
import { SeerahAppCard } from "@/components/place/SeerahAppCard";
import { SHOW_SEERAH_APP } from "@/lib/constants";
import { GuideChat } from "@/components/guide/GuideChat";
import { QrCheckin } from "@/components/place/QrCheckin";
import { DistanceToHere } from "@/components/place/DistanceToHere";
import { VisitInfoCard } from "@/components/place/VisitInfoCard";
import { PlaceMapLazy } from "@/components/map/LazyMaps";
import { TelegramIconLink } from "@/components/layout/TelegramIconLink";

/**
 * /places/[slug] and /en/places/[slug]. The route files set the request locale
 * before rendering. On English pages the row's display columns hold English
 * (src/lib/i18n-content.ts): a text with no current translation is null, so
 * its section simply isn't rendered — never an empty heading.
 */

type Params = Promise<{ slug: string }>;

export async function placeStaticParams() {
  const slugs = await getPublishedSlugs();
  return slugs.map((slug) => ({ slug }));
}

/**
 * The place's Arabic row, once per request (metadata and page share it). Each
 * language's view is localized from it, so an English page still knows the
 * Arabic name (and an Arabic page the English one) for the structured data.
 */
const loadPlace = cache((rawSlug: string) => getPlaceBySlug(decodeURIComponent(rawSlug), "ar"));

async function resolvePlace(rawSlug: string, lang: Lang) {
  const arabic = await loadPlace(rawSlug);
  return arabic ? { arabic, place: localizePlace(arabic, lang) } : null;
}

const placePath = (slug: string) => `/places/${encodeURIComponent(slug)}`;

export async function placeMetadata(lang: Lang, params: Params): Promise<Metadata> {
  const { slug } = await params;
  const found = await resolvePlace(slug, lang);
  if (!found) return {};
  const { place } = found;
  // Pre-generated 1600 JPEG doubles as the share image (Arabic-safe); a
  // video-only place falls back to its poster frame.
  return pageMetadata({
    lang,
    path: placePath(place.slug),
    title: place.name_ar,
    description: stripVerify(place.summary_ar),
    image: shareImageOf(coverImage(place.media), place.name_ar),
    article: { modifiedTime: place.last_updated },
  });
}

export async function PlaceView({ lang, params }: { lang: Lang; params: Params }) {
  const { slug } = await params;
  const found = await resolvePlace(slug, lang);
  if (!found) notFound();
  const { arabic, place } = found;

  const t = await getTranslations("place");
  const tCommon = await getTranslations("common");
  const tNav = await getTranslations("nav");
  const tSeo = await getTranslations("seo");
  const meta = CATEGORY_META[place.category];
  // Verified claims only (RLS + the query's filter); English: reviewed English only.
  const claims = await getPlaceClaims(place.id, lang);

  // Everything below renders from the sanitized view only — the raw row (with
  // [VERIFY] markers and owner notes) never crosses into the rendered tree.
  const view = toPublicPlaceView(place, googleMapsUrl(place));

  const lastUpdated = new Intl.DateTimeFormat(INTL_LOCALE[lang], {
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
              <span style={{ color: meta.tintOnDark }}>{t(`category.${place.category}`)}</span>
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
                href={`${placePath(place.slug)}/tour`}
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
        {/* English texts are translations of the reviewed Arabic, not yet
            reviewed themselves: say so before the reader meets the story. */}
        {lang === "en" && (
          <p className="text-sm leading-relaxed text-muted">{tCommon("translationNote")}</p>
        )}

        <QrCheckin slug={place.slug} name={place.name_ar} />

        {view.quote && <FeaturedQuote quote={view.quote} source={view.quoteSource} />}

        {/* "How far am I from here?" sits right on top of the visit info,
            grouped with it; keyed by slug so a client-side move to another
            place starts fresh (no distance or QR state carried over). */}
        {view.lat != null && view.lng != null ? (
          <div className="space-y-3">
            <DistanceToHere key={place.slug} name={place.name_ar} lat={view.lat} lng={view.lng} />
            <VisitInfoCard place={view} />
          </div>
        ) : (
          <VisitInfoCard place={view} />
        )}

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

        <WafaClaims claims={claims} lang={lang} />

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

        <GuideChat place={place.slug} />

        {SHOW_SEERAH_APP && <SeerahAppCard />}

        <RelatedPlaces slugs={view.relatedSlugs} lang={lang} />

        <footer className="border-t border-ink/10 pt-4 text-base text-muted">
          {tCommon("lastUpdated", { date: lastUpdated })}
        </footer>
      </div>

      {/* Built from the cleaned public view only: no [VERIFY] text can reach it. */}
      <JsonLd
        data={jsonLdGraph(
          placeNode({
            slug: view.slug,
            lang,
            category: view.category,
            name: view.name_ar,
            names: [arabic.name_ar, localizePlace(arabic, "en").name_ar],
            description: view.summary,
            images: placeImageUrls(place.media),
            lat: view.lat,
            lng: view.lng,
            mapsUrl: view.mapsUrl,
            openingHours: view.openingHours,
            city: tSeo("city"),
          }),
          breadcrumbNode(lang, [
            [tNav("home"), "/"],
            [tNav("places"), "/places"],
            [view.name_ar, placePath(view.slug)],
          ])
        )}
      />
    </article>
  );
}
