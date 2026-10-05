import type { MetadataRoute } from "next";
import { getPublishedJourneys, getPublishedSlugs, getRouteSlugs } from "@/lib/queries";
import { hasEnglishVersion } from "@/lib/journey-view";
import { siteUrl } from "@/lib/constants";
import { localizeHref } from "@/lib/i18n";

type Freq = NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;

/**
 * Every public page in both languages: the Arabic URL and its /en twin, each
 * listing the other (and Arabic as x-default) as hreflang alternates. A journey
 * without a complete English version has no indexable /en twin (its English
 * page is noindex and canonicalises to the Arabic), so it is listed once.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [slugs, routeSlugs, journeys] = await Promise.all([getPublishedSlugs(), getRouteSlugs(), getPublishedJourneys()]);

  const page = (path: string, changeFrequency: Freq, priority: number): MetadataRoute.Sitemap => {
    const ar = path === "/" ? base : `${base}${path}`;
    const en = `${base}${localizeHref(path, "en")}`;
    const alternates = { languages: { ar, en, "x-default": ar } };
    return [
      { url: ar, changeFrequency, priority, alternates },
      { url: en, changeFrequency, priority, alternates },
    ];
  };
  const arabicOnly = (path: string, changeFrequency: Freq, priority: number): MetadataRoute.Sitemap => [
    { url: `${base}${path}`, changeFrequency, priority },
  ];

  return [
    ...page("/", "weekly", 1),
    ...page("/places", "weekly", 0.9),
    ...page("/journeys", "weekly", 0.8),
    ...page("/stories", "weekly", 0.7),
    ...page("/plan", "monthly", 0.7),
    ...page("/map", "monthly", 0.6),
    ...page("/routes", "monthly", 0.7),
    ...page("/privacy", "yearly", 0.2),
    ...slugs.flatMap((slug) => page(`/places/${encodeURIComponent(slug)}`, "weekly", 0.8)),
    ...journeys.flatMap((j) => (hasEnglishVersion(j) ? page : arabicOnly)(`/journeys/${encodeURIComponent(j.slug)}`, "monthly", 0.7)),
    ...routeSlugs.flatMap((slug) => page(`/routes/${encodeURIComponent(slug)}`, "monthly", 0.6)),
  ];
}
