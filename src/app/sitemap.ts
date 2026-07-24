import type { MetadataRoute } from "next";
import { getPublishedSlugs, getRouteIds } from "@/lib/queries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const [slugs, routeIds] = await Promise.all([getPublishedSlugs(), getRouteIds()]);

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
    ...routeIds.map((id) => ({
      url: `${base}/routes/${id}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}