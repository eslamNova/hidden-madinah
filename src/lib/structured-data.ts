import { ogImageOf } from "@/lib/article-format";
import { SITE_DESCRIPTION, SITE_DESCRIPTION_EN, SITE_NAME, SITE_NAME_EN, siteUrl, TELEGRAM_CHANNEL, WAFA_BOOK } from "@/lib/constants";
import { coverImage, type OpeningHours } from "@/lib/content";
import type { Tables } from "@/lib/database.types";
import { localizeHref, type Lang } from "@/lib/i18n";
import type { PlaceCategory } from "@/lib/maps";

/**
 * schema.org builders for the <JsonLd> component (src/components/seo/JsonLd.tsx).
 *
 * Every builder takes only display-ready, public values — a place's fields
 * come from its cleaned public view (toPublicPlaceView / the localized rows),
 * stories and journey stops from verified claims — so nothing marked
 * [VERIFY] or unreviewed can reach the structured data.
 *
 * Stable @ids tie the pages together: one Organization, one WebSite per
 * language, one entity per place ("<site>/places/<slug>#place", the same in
 * both languages), and one Book for Wafa al-Wafa that journeys, routes and
 * stories cite.
 */

export type JsonLdNode = Record<string, unknown>;

/** A JSON-LD document of several nodes. */
export const jsonLdGraph = (...nodes: (JsonLdNode | null | undefined | false)[]) => ({
  "@context": "https://schema.org",
  "@graph": nodes.filter(Boolean),
});

/** Absolute URL of an internal path ("/" → the bare origin, as in the sitemap). */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return path === "/" ? siteUrl() : `${siteUrl()}${path}`;
}

/** Absolute URL of an Arabic path in the given language. */
export const pageUrl = (arPath: string, lang: Lang) => absoluteUrl(localizeHref(arPath, lang));

export const organizationId = () => `${siteUrl()}/#organization`;
export const websiteId = (lang: Lang) => `${pageUrl("/", lang)}#website`;
export const wafaBookId = () => `${siteUrl()}/sources#wafa-al-wafa`;
/** One entity per place, shared by both languages and by every page that mentions it. */
export const placeEntityId = (slug: string) => `${siteUrl()}/places/${encodeURIComponent(slug)}#place`;

const other = (lang: Lang): Lang => (lang === "ar" ? "en" : "ar");

/** The site's publisher. publishingPrinciples is the public sources and method page. */
export function organizationNode(lang: Lang): JsonLdNode {
  const names = { ar: SITE_NAME, en: SITE_NAME_EN };
  return {
    "@type": "Organization",
    "@id": organizationId(),
    name: names[lang],
    alternateName: names[other(lang)],
    url: absoluteUrl("/"),
    logo: { "@type": "ImageObject", url: absoluteUrl("/icons/icon-512.png"), width: 512, height: 512 },
    sameAs: [TELEGRAM_CHANNEL],
    publishingPrinciples: pageUrl("/sources", lang),
  };
}

export function websiteNode(lang: Lang): JsonLdNode {
  const names = { ar: SITE_NAME, en: SITE_NAME_EN };
  return {
    "@type": "WebSite",
    "@id": websiteId(lang),
    url: pageUrl("/", lang),
    name: names[lang],
    alternateName: names[other(lang)],
    description: lang === "en" ? SITE_DESCRIPTION_EN : SITE_DESCRIPTION,
    inLanguage: lang,
    publisher: { "@id": organizationId() },
    publishingPrinciples: pageUrl("/sources", lang),
  };
}

/** The shared Book entry for Wafa al-Wafa (the edition every claim cites). */
export function wafaBookNode(lang: Lang): JsonLdNode {
  return {
    "@type": "Book",
    "@id": wafaBookId(),
    name: WAFA_BOOK.title.ar,
    alternateName: WAFA_BOOK.title.en,
    inLanguage: "ar",
    author: { "@type": "Person", name: WAFA_BOOK.author.ar, alternateName: WAFA_BOOK.author.en },
    publisher: { "@type": "Organization", name: WAFA_BOOK.publisher.ar, alternateName: WAFA_BOOK.publisher.en },
    bookEdition: WAFA_BOOK.edition[lang],
    url: WAFA_BOOK.url,
    identifier: { "@type": "PropertyValue", propertyID: "Turath book", value: WAFA_BOOK.turathId },
  };
}

/** A citation to a printed volume and page of the shared Book entry. */
export function wafaPageCitation(vol: number, page: number, label: string): JsonLdNode {
  return {
    "@type": "PublicationVolume",
    name: label,
    volumeNumber: String(vol),
    pagination: String(page),
    isPartOf: { "@id": wafaBookId() },
  };
}

/**
 * A place's images for structured data and the sitemap: the cover as its
 * 1600px JPEG first, then the other photos' 1600px WebP (the cover's own
 * WebP is the same picture, so it is skipped).
 */
export function placeImageUrls(media: Pick<Tables<"media">, "type" | "url" | "thumb_url" | "width" | "height">[], max = 6): string[] {
  const cover = coverImage(media);
  const coverJpeg = cover ? ogImageOf(cover) : null;
  const photos = media
    .filter((m) => m.type === "photo" && m.width && m.height)
    .map((m) => m.url)
    .filter((url) => url.replace(/\.webp$/, ".jpg") !== coverJpeg);
  return [...new Set([...(coverJpeg ? [coverJpeg] : []), ...photos])].slice(0, max).map(absoluteUrl);
}

/** schema.org types of a place: mosques are Mosques; wells, gardens and sites are landmarks. */
export function placeTypes(category: PlaceCategory): string[] {
  return category === "mosque" ? ["Mosque", "TouristAttraction"] : ["TouristAttraction", "LandmarksOrHistoricalBuildings"];
}

/** A short reference to a place entity (for itineraries, articles and videos). */
export function placeRef(p: { slug: string; name: string; category: PlaceCategory }, lang: Lang): JsonLdNode {
  return {
    "@type": placeTypes(p.category),
    "@id": placeEntityId(p.slug),
    name: p.name,
    url: pageUrl(`/places/${encodeURIComponent(p.slug)}`, lang),
  };
}

/** Madinah, as the city every place is in. */
function madinah(city: string): JsonLdNode {
  return { "@type": "City", name: city, sameAs: "https://en.wikipedia.org/wiki/Medina" };
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function openingHoursSpecification(hours: OpeningHours | null): JsonLdNode[] | undefined {
  if (!hours) return undefined;
  const slots: [string, string][] = hours.always ? [["00:00", "23:59"]] : hours.daily;
  if (slots.length === 0) return undefined;
  return slots.map(([opens, closes]) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: DAYS, opens, closes }));
}

export type PlaceJsonLdInput = {
  slug: string;
  lang: Lang;
  category: PlaceCategory;
  /** The name in the page's language. */
  name: string;
  /** The place's names in both languages (duplicates of `name` are dropped). */
  names: string[];
  description: string | null;
  /** Absolute image URLs, best first. */
  images: string[];
  lat: number | null;
  lng: number | null;
  mapsUrl: string | null;
  openingHours: OpeningHours | null;
  /** The city's name in the page's language (messages: seo.city). */
  city: string;
};

export function placeNode(p: PlaceJsonLdInput): JsonLdNode {
  const alternateName = [...new Set(p.names.map((n) => n.trim()).filter((n) => n && n !== p.name))];
  const hours = openingHoursSpecification(p.openingHours);
  return {
    "@type": placeTypes(p.category),
    "@id": placeEntityId(p.slug),
    name: p.name,
    ...(alternateName.length ? { alternateName } : {}),
    ...(p.description ? { description: p.description } : {}),
    url: pageUrl(`/places/${encodeURIComponent(p.slug)}`, p.lang),
    ...(p.images.length ? { image: p.images } : {}),
    ...(p.lat != null && p.lng != null ? { geo: { "@type": "GeoCoordinates", latitude: p.lat, longitude: p.lng } } : {}),
    address: { "@type": "PostalAddress", addressLocality: p.city, addressCountry: "SA" },
    ...(p.mapsUrl ? { hasMap: p.mapsUrl } : {}),
    // Mosques are open to every visitor at no charge; some gardens and
    // sites sell tickets, so the others say nothing rather than guess.
    ...(p.category === "mosque" ? { isAccessibleForFree: true } : {}),
    containedInPlace: madinah(p.city),
    ...(hours ? { openingHoursSpecification: hours } : {}),
  };
}

/** Breadcrumbs as [name, Arabic path] pairs, in order. */
export function breadcrumbNode(lang: Lang, crumbs: [string, string][]): JsonLdNode {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map(([name, path], i) => ({
      "@type": "ListItem",
      position: i + 1,
      name,
      item: pageUrl(path, lang),
    })),
  };
}

export type TripStop = { name: string; place: { slug: string; category: PlaceCategory } | null };

/**
 * A journey or a curated route: a TouristTrip whose itinerary is its stops
 * (each a place entity by @id), citing the shared Wafa al-Wafa Book entry.
 */
export function touristTripNode({
  lang,
  path,
  name,
  description,
  image,
  stops,
}: {
  lang: Lang;
  path: string;
  name: string;
  description: string | null;
  image: string | null;
  stops: TripStop[];
}): JsonLdNode {
  const url = pageUrl(path, lang);
  return {
    "@type": "TouristTrip",
    "@id": `${url}#trip`,
    name,
    ...(description ? { description } : {}),
    url,
    inLanguage: lang,
    ...(image ? { image: absoluteUrl(image) } : {}),
    provider: { "@id": organizationId() },
    itinerary: {
      "@type": "ItemList",
      numberOfItems: stops.length,
      itemListElement: stops.map((s, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: s.place ? placeRef({ ...s.place, name: s.name }, lang) : { "@type": "Place", name: s.name },
      })),
    },
    citation: { "@id": wafaBookId() },
  };
}

/** ISO 8601 duration ("PT1M15S") of a whole number of seconds. */
export function isoDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return `PT${m ? `${m}M` : ""}${s % 60 || !m ? `${s % 60}S` : ""}`;
}

export type VideoJsonLdInput = {
  /** Fragment-unique id on the page (the media row id). */
  id: string;
  pageUrl: string;
  name: string;
  description: string;
  thumbnailUrl: string;
  contentUrl: string;
  durationSeconds: number | null;
  /** ISO date the video was first published — only when it is actually stored. */
  uploadDate: string | null;
  placeSlug: string | null;
};

export function videoNode(v: VideoJsonLdInput): JsonLdNode {
  return {
    "@type": "VideoObject",
    "@id": `${v.pageUrl}#video-${v.id}`,
    name: v.name,
    description: v.description,
    thumbnailUrl: [absoluteUrl(v.thumbnailUrl)],
    contentUrl: absoluteUrl(v.contentUrl),
    ...(v.uploadDate ? { uploadDate: v.uploadDate } : {}),
    ...(v.durationSeconds ? { duration: isoDuration(v.durationSeconds) } : {}),
    ...(v.placeSlug ? { contentLocation: { "@id": placeEntityId(v.placeSlug) } } : {}),
    publisher: { "@id": organizationId() },
  };
}
