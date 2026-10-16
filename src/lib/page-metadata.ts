import type { Metadata } from "next";
import { ogImageOf } from "@/lib/article-format";
import type { CoverImage } from "@/lib/content";
import { siteDescription, siteName } from "@/lib/constants";
import { languageAlternates, localizeHref, type Lang } from "@/lib/i18n";

/**
 * One builder for every public page's <head>: title, description, canonical
 * and hreflang, and a complete Open Graph and X card.
 *
 * Next merges metadata one top-level key at a time: a page that sets
 * `openGraph` at all replaces the root layout's whole object (that is how
 * place pages lost og:site_name), and a page that sets no `twitter` keeps the
 * layout's default image. Every view's metadata function goes through here,
 * so each share card is page-specific and complete, with og:url.
 */

export const OG_LOCALE: Record<Lang, string> = { ar: "ar_SA", en: "en_US" };

/** The site-wide share image (public/og-image.jpg). */
export const DEFAULT_SHARE_IMAGE = { url: "/og-image.jpg", width: 1200, height: 630 } as const;

/** A share image; width and height only when they are known to be exact. */
export type ShareImage = { url: string; width?: number; height?: number; alt?: string };

/**
 * A place or journey cover as a share image: the pre-generated 1600px JPEG
 * of a photo (Arabic-safe in every share preview), or a video's poster frame.
 * Media rows store the 1600 variant's (or the poster's) exact size.
 */
export function shareImageOf(cover: CoverImage | null, alt?: string): ShareImage | null {
  if (!cover) return null;
  return { url: ogImageOf(cover), width: cover.width, height: cover.height, alt };
}

export type PageMetadataInput = {
  lang: Lang;
  /** The page's Arabic path ("/places/masjid-quba"); the English URL is derived. */
  path: string;
  /** Page title (the root layout's template appends the site name). Omit on the home page. */
  title?: string;
  description?: string | null;
  image?: ShareImage | null;
  /**
   * false: the page has no English twin. Its canonical is the Arabic URL and
   * no hreflang is emitted (journeys and articles without English).
   */
  bilingual?: boolean;
  noindex?: boolean;
  /** Open Graph article fields; given, the page's og:type is "article". */
  article?: { publishedTime?: string; modifiedTime?: string; authors?: string[]; tags?: string[] };
};

export function pageMetadata({
  lang,
  path,
  title,
  description,
  image,
  bilingual = true,
  noindex = false,
  article,
}: PageMetadataInput): Metadata {
  const name = siteName(lang);
  const desc = description?.trim() || siteDescription(lang);
  const url = bilingual ? localizeHref(path, lang) : path;
  const shareTitle = title ?? name;
  const img = image ?? DEFAULT_SHARE_IMAGE;
  const alt = image?.alt ?? shareTitle;
  const ogImage = { url: img.url, ...(img.width && img.height ? { width: img.width, height: img.height } : {}), alt };
  const og = {
    title: shareTitle,
    description: desc,
    url,
    siteName: name,
    locale: OG_LOCALE[lang],
    ...(bilingual ? { alternateLocale: OG_LOCALE[lang === "ar" ? "en" : "ar"] } : {}),
    images: [ogImage],
  };

  return {
    ...(title ? { title } : {}),
    description: desc,
    alternates: bilingual ? languageAlternates(path, lang) : { canonical: path },
    openGraph: article ? { ...og, type: "article", ...article } : { ...og, type: "website" },
    twitter: { card: "summary_large_image", title: shareTitle, description: desc, images: [{ url: img.url, alt }] },
    ...(noindex ? { robots: { index: false, follow: true } } : {}),
  };
}
