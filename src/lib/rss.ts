import { getTranslations } from "next-intl/server";
import { getPublishedArticles } from "@/lib/articles";
import { siteName, siteUrl } from "@/lib/constants";
import { localizeHref, type Lang } from "@/lib/i18n";

/**
 * RSS 2.0 feed of published articles: /blog/rss.xml (Arabic, every article)
 * and /en/blog/rss.xml (articles with an English version). Served by static
 * route handlers that revalidate with the rest of the site.
 */

const xml = (s: string) =>
  s
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const rfc822 = (iso: string) => new Date(iso).toUTCString();

export async function articlesFeed(lang: Lang): Promise<Response> {
  const t = await getTranslations({ locale: lang, namespace: "blog" });
  const { articles } = await getPublishedArticles(lang);
  const base = siteUrl();
  const abs = (path: string) => `${base}${localizeHref(path, lang)}`;
  const self = abs("/blog/rss.xml");
  const latest = Math.max(0, ...articles.map((a) => Date.parse(a.updatedAt)).filter(Number.isFinite));

  const items = articles.map((a) => {
    const link = abs(`/blog/${a.slug}`);
    return [
      "    <item>",
      `      <title>${xml(a.title)}</title>`,
      `      <link>${xml(link)}</link>`,
      `      <guid isPermaLink="true">${xml(link)}</guid>`,
      `      <pubDate>${rfc822(a.publishedAt)}</pubDate>`,
      ...(a.excerpt ? [`      <description>${xml(a.excerpt)}</description>`] : []),
      ...a.tags.map((tag) => `      <category>${xml(tag)}</category>`),
      "    </item>",
    ].join("\n");
  });

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${xml(`${t("title")} | ${siteName(lang)}`)}</title>`,
    `    <link>${xml(abs("/blog"))}</link>`,
    `    <description>${xml(t("subtitle"))}</description>`,
    `    <language>${lang}</language>`,
    `    <atom:link href="${xml(self)}" rel="self" type="application/rss+xml"/>`,
    ...(latest ? [`    <lastBuildDate>${new Date(latest).toUTCString()}</lastBuildDate>`] : []),
    ...items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
