import type { MetadataRoute } from "next";
import { getPublishedSlugs, getRouteSlugs } from "@/lib/queries";
import { siteUrl } from "@/lib/constants";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [slugs, routeSlugs] = await Promise.all([getPublishedSlugs(), getRouteSlugs()]);

  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/places`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/map`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/routes`, changeFrequency: "monthly", priority: 0.7 },
    ...slugs.map((slug) => ({
      url: `${base}/places/${encodeURIComponent(slug)}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...routeSlugs.map((slug) => ({
      url: `${base}/routes/${encodeURIComponent(slug)}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}