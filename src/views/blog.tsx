import type { Metadata } from "next";
import NextLink from "next/link";
import { getTranslations } from "next-intl/server";
import { MapPin, Rss } from "lucide-react";
import Link from "@/components/i18n/Link";
import { articleCover, KNOWN_ARTICLE_TAGS } from "@/lib/article-format";
import { getPublishedArticles } from "@/lib/articles";
import { coverImage } from "@/lib/content";
import { HERO_IMAGES } from "@/lib/hero-images";
import { INTL_LOCALE, languageAlternates, localizeHref, type Lang } from "@/lib/i18n";
import { getPlacesBySlugs } from "@/lib/queries";
import { PageHero } from "@/components/layout/PageHero";
import { PlaceImage } from "@/components/place/PlaceImage";
import { JourneyTagFilter, type JourneyTagOption } from "@/components/journey/JourneyTagFilter";

/**
 * /blog and /en/blog — «المقالات»: the owner's articles, newest first, with
 * the places each one is about. The route files set the request locale before
 * rendering. English lists only articles with an English version; the rest
 * stay one tap away in Arabic (the journeys / stories rule).
 */
export async function blogMetadata(lang: Lang): Promise<Metadata> {
  const t = await getTranslations("blog");
  return {
    title: t("title"),
    description: t("subtitle"),
    alternates: {
      ...languageAlternates("/blog", lang),
      types: { "application/rss+xml": [{ url: localizeHref("/blog/rss.xml", lang), title: t("rssTitle") }] },
    },
  };
}

export async function BlogView({ lang }: { lang: Lang }) {
  const t = await getTranslations("blog");
  const { articles, arabicOnly } = await getPublishedArticles(lang);
  const places = await getPlacesBySlugs([...new Set(articles.flatMap((a) => a.placeSlugs))], lang);
  const placeBySlug = new Map(places.map((p) => [p.slug, p]));
  const date = new Intl.DateTimeFormat(INTL_LOCALE[lang], { dateStyle: "long", timeZone: "Asia/Riyadh" });

  // Unknown tags still filter, under a readable form of their own spelling.
  const tagLabel = (tag: string) => (t.has(`tags.${tag}`) ? t(`tags.${tag}`) : tag.replace(/[-_]+/g, " "));
  const known: readonly string[] = KNOWN_ARTICLE_TAGS;
  const rank = (tag: string) => (known.includes(tag) ? known.indexOf(tag) : known.length);
  const tagOptions: JourneyTagOption[] = [...new Set(articles.flatMap((a) => a.tags))]
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
    .map((value) => ({ value, label: tagLabel(value) }));

  const items = articles.map((a) => {
    const linked = a.placeSlugs.flatMap((s) => placeBySlug.get(s) ?? []);
    const cover = articleCover(a.coverUrl) ?? coverImage(linked.flatMap((p) => p.media));
    const card = (
      <article className="card-elevated overflow-hidden">
        <Link href={`/blog/${a.slug}`} className="card-lift block">
          {cover && (
            <PlaceImage media={cover} alt="" sizes="(max-width: 768px) 92vw, 720px" className="aspect-[16/9] w-full object-cover" />
          )}
          <div className="space-y-2 p-5 pb-4">
            <p className="text-sm font-medium text-muted">
              <time dateTime={a.publishedAt}>{date.format(new Date(a.publishedAt))}</time>
            </p>
            <h2 className="text-2xl leading-snug">{a.title}</h2>
            {a.excerpt && <p className="line-clamp-3 text-lg leading-relaxed text-muted">{a.excerpt}</p>}
            <span className="inline-block font-semibold text-brand underline">{t("readMore")}</span>
          </div>
        </Link>
        {linked.length > 0 && (
          <ul aria-label={t("placesLabel")} className="flex flex-wrap gap-2 px-5 pb-5">
            {linked.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/places/${encodeURIComponent(p.slug)}`}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary/10 px-3 text-sm font-medium text-brand-dark"
                >
                  <MapPin aria-hidden="true" className="h-4 w-4 shrink-0" />
                  {p.name_ar}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </article>
    );
    return { id: a.slug, tags: a.tags, card };
  });

  const day = Math.floor(Date.now() / 86_400_000);
  const heroPhoto = articleCover(articles[0]?.coverUrl) ?? HERO_IMAGES[(day + 3) % HERO_IMAGES.length] ?? null;

  // next/link, not the localizing Link: this one must stay on the Arabic URL.
  const arabicLink = (
    <NextLink href="/blog" hrefLang="ar" className="font-semibold text-brand underline">
      {t("openArabic")}
    </NextLink>
  );

  return (
    <>
      <PageHero photo={heroPhoto} title={t("title")} subtitle={t("subtitle")} />
      <div className="mx-auto max-w-3xl space-y-5 px-4 pb-10 pt-8">
        {articles.length === 0 ? (
          <div className="card-elevated space-y-4 p-8 text-center text-lg">
            {lang === "en" && arabicOnly > 0 ? (
              <>
                <p className="text-muted">{t("listNotInEnglish")}</p>
                <p>{arabicLink}</p>
              </>
            ) : (
              <>
                <p className="text-muted">{t("empty")}</p>
                <Link
                  href="/places"
                  className="inline-flex min-h-12 items-center rounded-full bg-primary px-5 font-semibold text-paper"
                >
                  {t("emptyCta")}
                </Link>
              </>
            )}
          </div>
        ) : (
          <>
            <p className="text-lg leading-relaxed">{t("intro")}</p>
            <JourneyTagFilter namespace="blog" tags={tagOptions} items={items} />
          </>
        )}

        {articles.length > 0 && arabicOnly > 0 && (
          <p className="text-center text-muted">
            {t("moreInArabic")} {arabicLink}
          </p>
        )}

        {articles.length > 0 && (
          // A plain <a>: the feed is a route handler, not a page to prefetch.
          <a
            href={localizeHref("/blog/rss.xml", lang)}
            type="application/rss+xml"
            className="mx-auto flex min-h-12 w-fit items-center gap-2 rounded-full px-4 font-medium text-muted underline"
          >
            <Rss aria-hidden="true" className="h-5 w-5 shrink-0" />
            {t("rss")}
          </a>
        )}
      </div>
    </>
  );
}
