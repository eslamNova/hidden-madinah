import type { MetadataRoute } from "next";
import { getTranslations } from "next-intl/server";
import { getPublishedArticles } from "@/lib/articles";
import { SOURCES_UPDATED_ISO, siteUrl } from "@/lib/constants";
import { localizeHref, type Lang } from "@/lib/i18n";
import { hasEnglishVersion } from "@/lib/journey-view";
import {
  getPublishedJourneys,
  getPublishedPlaces,
  getRoutesWithStops,
  getVerifiedClaimDates,
  type PlaceWithMedia,
} from "@/lib/queries";
import { placeImageUrls } from "@/lib/structured-data";
import { nabawiSlides, tourVideos, toTourSlides } from "@/lib/tour";

type Entry = MetadataRoute.Sitemap[number];
type Freq = NonNullable<Entry["changeFrequency"]>;
type Extras = Pick<Entry, "images" | "videos">;

/**
 * Every public page in both languages: the Arabic URL and its /en twin, each
 * listing the other (and Arabic as x-default) as hreflang alternates. A journey
 * without a complete English version has no indexable /en twin (its English
 * page is noindex and canonicalises to the Arabic), so it is listed once; so
 * is an article without an English title and body.
 *
 * lastModified is the newest date the page's content carries: a place's
 * last_updated or the approval of one of its verified claims (they appear on
 * its page «من وفاء الوفاء»), a journey's newest cited claim, the stories'
 * newest approved story, an article's updated_at. Place pages list their
 * photos; the photo-tour pages (video pages) list their videos.
 *
 * Next writes these values into the XML as they are, so every string here is
 * escaped (xml()).
 */

const xml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** The newest of some ISO dates (undefined when there are none). */
function latest(...dates: (string | null | undefined)[]): string | undefined {
  const times = dates.flatMap((d) => (d && Number.isFinite(Date.parse(d)) ? [Date.parse(d)] : []));
  return times.length ? new Date(Math.max(...times)).toISOString() : undefined;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const abs = (path: string) => (/^https?:\/\//.test(path) ? path : `${base}${path}`);
  const [places, placesEn, routes, journeys, { articles }, claimDates, tourAr, tourEn] = await Promise.all([
    getPublishedPlaces("ar"),
    getPublishedPlaces("en"),
    getRoutesWithStops("ar"),
    getPublishedJourneys("ar"),
    getPublishedArticles("ar"),
    getVerifiedClaimDates(),
    getTranslations({ locale: "ar", namespace: "tour" }),
    getTranslations({ locale: "en", namespace: "tour" }),
  ]);

  // ── Dates ────────────────────────────────────────────────────────────────
  const claimDate = new Map(claimDates.map((c) => [c.id, c.date]));
  const placeClaimDates = new Map<string, string[]>();
  for (const c of claimDates) if (c.placeId) placeClaimDates.set(c.placeId, [...(placeClaimDates.get(c.placeId) ?? []), c.date]);
  const placeDate = (p: PlaceWithMedia) => latest(p.last_updated, ...(placeClaimDates.get(p.id) ?? []));
  const placesDate = latest(...places.map(placeDate));
  const journeyDate = (j: (typeof journeys)[number]) =>
    latest(j.created_at, ...j.stops.flatMap((s) => (s.claim_ids ?? []).map((id) => claimDate.get(id))));
  const storiesDate = latest(...claimDates.filter((c) => c.kind === "humane").map((c) => c.date));

  // ── Media ────────────────────────────────────────────────────────────────
  const placeImages = (p: PlaceWithMedia): string[] => placeImageUrls(p.media, 20).map(xml);
  const enBySlug = new Map(placesEn.map((p) => [p.slug, p]));
  const translators = { ar: tourAr, en: tourEn };
  const videosOf = (lang: Lang, slides: ReturnType<typeof toTourSlides>, fallback: string): Extras =>
    ({
      videos: tourVideos(slides, (name, n) => translators[lang]("videoName", { name, n }), fallback).map((v) => ({
        title: xml(v.name),
        description: xml(v.description),
        thumbnail_loc: xml(abs(v.thumbnailUrl)),
        content_loc: xml(abs(v.contentUrl)),
        ...(v.durationSeconds ? { duration: v.durationSeconds } : {}),
      })),
    });
  const siteTourSlides = (lang: Lang) => [
    ...nabawiSlides(translators[lang]("nabawiName"), translators[lang]("nabawiSummary")),
    ...toTourSlides(lang === "ar" ? places : placesEn),
  ];

  // ── Entries ──────────────────────────────────────────────────────────────
  const page = (
    path: string,
    changeFrequency: Freq,
    priority: number,
    lastModified?: string,
    extras?: Partial<Record<Lang, Extras>>
  ): MetadataRoute.Sitemap => {
    const ar = path === "/" ? base : `${base}${path}`;
    const en = `${base}${localizeHref(path, "en")}`;
    const alternates = { languages: { ar, en, "x-default": ar } };
    const dated = lastModified ? { lastModified } : {};
    return [
      { url: ar, ...dated, changeFrequency, priority, alternates, ...extras?.ar },
      { url: en, ...dated, changeFrequency, priority, alternates, ...extras?.en },
    ];
  };
  const arabicOnly = (path: string, changeFrequency: Freq, priority: number, lastModified?: string): MetadataRoute.Sitemap => [
    { url: `${base}${path}`, ...(lastModified ? { lastModified } : {}), changeFrequency, priority },
  ];
  const placePath = (slug: string) => `/places/${encodeURIComponent(slug)}`;

  return [
    ...page("/", "weekly", 1, placesDate),
    ...page("/places", "weekly", 0.9, placesDate),
    ...page("/journeys", "weekly", 0.8, latest(...journeys.map(journeyDate))),
    ...page("/stories", "weekly", 0.7, storiesDate),
    ...page("/blog", "weekly", 0.7, latest(...articles.map((a) => a.updatedAt))),
    ...page("/plan", "monthly", 0.7),
    ...page("/map", "monthly", 0.6, placesDate),
    ...page("/routes", "monthly", 0.7),
    ...page("/tour", "monthly", 0.6, latest(...places.map((p) => p.last_updated)), {
      ar: videosOf("ar", siteTourSlides("ar"), tourAr("metaDescription")),
      en: videosOf("en", siteTourSlides("en"), tourEn("metaDescription")),
    }),
    ...page("/sources", "yearly", 0.4, SOURCES_UPDATED_ISO),
    ...page("/privacy", "yearly", 0.2),
    ...places.flatMap((p) => {
      const images = placeImages(p);
      return page(placePath(p.slug), "weekly", 0.8, placeDate(p), images.length ? { ar: { images }, en: { images } } : undefined);
    }),
    // A place's photo tour is a page only when the place has media.
    ...places
      .filter((p) => p.media.length > 0)
      .flatMap((p) => {
        const en = enBySlug.get(p.slug) ?? p;
        const fallback = (lang: Lang, place: PlaceWithMedia) =>
          translators[lang]("placeMetaDescription", { name: place.name_ar, count: toTourSlides([place]).length });
        return page(`${placePath(p.slug)}/tour`, "monthly", 0.5, p.last_updated, {
          ar: videosOf("ar", toTourSlides([p]), fallback("ar", p)),
          en: videosOf("en", toTourSlides([en]), fallback("en", en)),
        });
      }),
    ...journeys.flatMap((j) =>
      (hasEnglishVersion(j) ? page : arabicOnly)(`/journeys/${encodeURIComponent(j.slug)}`, "monthly", 0.7, journeyDate(j))
    ),
    ...routes.flatMap((r) =>
      page(`/routes/${encodeURIComponent(r.slug)}`, "monthly", 0.6, latest(...r.stops.map((s) => s.last_updated)))
    ),
    ...articles.flatMap((a) => (a.hasEnglish ? page : arabicOnly)(`/blog/${a.slug}`, "monthly", 0.6, a.updatedAt)),
  ];
}
