import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getTranslations } from "next-intl/server";
import { BookOpen, ChevronLeft, Route } from "lucide-react";
import Link from "@/components/i18n/Link";
import { articleCover, articleShareImage, bodySummary, SLUG_RE } from "@/lib/article-format";
import { articleHtml } from "@/lib/article-html";
import { getArticle, getArticleSlugs, getPublishedArticles, type Article } from "@/lib/articles";
import { SITE_NAME, SITE_NAME_EN } from "@/lib/constants";
import { coverImage, type CoverImage } from "@/lib/content";
import { HERO_IMAGES } from "@/lib/hero-images";
import { INTL_LOCALE, type Lang } from "@/lib/i18n";
import { hasEnglishVersion, journeyTexts } from "@/lib/journey-view";
import { DEFAULT_SHARE_IMAGE, pageMetadata, shareImageOf, type ShareImage } from "@/lib/page-metadata";
import { getPlacesBySlugs, getPublishedJourneys, type PlaceWithMedia } from "@/lib/queries";
import { absoluteUrl, organizationId, pageUrl, placeRef } from "@/lib/structured-data";
import { PageHero } from "@/components/layout/PageHero";
import { PlaceCard, toPlaceCardData } from "@/components/place/PlaceCard";
import { JsonLd } from "@/components/seo/JsonLd";
import { ShareButtons } from "@/components/blog/ShareButtons";

/**
 * /blog/[slug] and /en/blog/[slug]. The route files set the request locale
 * before rendering. The body is the owner's text from the visual editor (HTML)
 * or, for older articles, Markdown; either way it is sanitised on the server
 * against a strict allowlist (src/lib/article-html.ts) before it reaches the
 * page.
 *
 * Shared links: the page's Open Graph / X card carries the cover (an editor
 * upload's JPEG twin with its exact size), else the first linked place's
 * photo, else the site's share image — always with alt text, og:type article
 * and the publication date. Share buttons sit under the text.
 *
 * An article without English (title and body) is not shown half-translated on
 * /en: the page says so and links to the Arabic, and it is kept out of search
 * engines and hreflang — the journeys rule.
 */

type Params = Promise<{ slug: string }>;

export async function articleStaticParams() {
  const slugs = await getArticleSlugs();
  return slugs.map((slug) => ({ slug }));
}

const articlePath = (slug: string) => `/blog/${slug}`;

// generateMetadata and the page read the same rows: once per request.
const load = cache(async (rawSlug: string, lang: Lang) => (SLUG_RE.test(rawSlug) ? getArticle(rawSlug, lang) : null));
const loadPlaces = cache((slugs: string, lang: Lang) => (slugs ? getPlacesBySlugs(slugs.split(","), lang) : Promise.resolve([])));

/** Cover, else the first linked place's photo; null when neither exists. */
function pickCover(article: Article, places: PlaceWithMedia[]): CoverImage | null {
  return articleCover(article.coverUrl) ?? coverImage(places.flatMap((p) => p.media));
}

const description = (article: Article) => article.excerpt ?? (article.body ? bodySummary(article.body) || undefined : undefined);

/**
 * The share image: the article's own cover, else the first linked place's
 * photo (exact size), else the site-wide share image (1200×630).
 */
function shareImage(article: Article, places: PlaceWithMedia[]): ShareImage {
  const own = articleShareImage(article.coverUrl);
  if (own) return { ...own, alt: article.title };
  return shareImageOf(coverImage(places.flatMap((p) => p.media)), article.title) ?? { ...DEFAULT_SHARE_IMAGE, alt: article.title };
}

export async function articleMetadata(lang: Lang, params: Params): Promise<Metadata> {
  const { slug } = await params;
  const article = await load(slug, lang);
  if (!article) return {};
  const path = articlePath(article.slug);

  if (!article.available) {
    // /en without English: one canonical Arabic page, and /en stays out of the index.
    const t = await getTranslations("blog");
    return pageMetadata({ lang, path, title: t("title"), bilingual: false, noindex: true });
  }

  const places = await loadPlaces(article.placeSlugs.join(","), lang);
  return pageMetadata({
    lang,
    path,
    title: article.title,
    description: description(article),
    // Sizes only when exact: an editor upload's (from its file name) or a place photo's.
    image: shareImage(article, places),
    // Arabic-only articles have no English twin to point to.
    bilingual: article.hasEnglish,
    article: {
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt,
      ...(article.author ? { authors: [article.author] } : {}),
      ...(article.tags.length ? { tags: article.tags } : {}),
    },
  });
}

export async function ArticleView({ lang, params }: { lang: Lang; params: Params }) {
  const { slug } = await params;
  const article = await load(slug, lang);
  if (!article) notFound();
  if (!article.available) return <NotInEnglish article={article} />;

  const t = await getTranslations("blog");
  const tj = await getTranslations("journey");
  const [places, journeys, listing] = await Promise.all([
    loadPlaces(article.placeSlugs.join(","), lang),
    article.journeySlugs.length ? getPublishedJourneys(lang) : Promise.resolve([]),
    getPublishedArticles(lang),
  ]);
  const linkedJourneys = article.journeySlugs.flatMap((s) => {
    const j = journeys.find((x) => x.slug === s);
    return j && (lang === "ar" || hasEnglishVersion(j)) ? [j] : [];
  });
  const more = listing.articles.filter((a) => a.slug !== article.slug).slice(0, 3);

  const day = Math.floor(Date.now() / 86_400_000);
  const cover = pickCover(article, places);
  const date = new Intl.DateTimeFormat(INTL_LOCALE[lang], { dateStyle: "long", timeZone: "Asia/Riyadh" });
  const published = date.format(new Date(article.publishedAt));
  const updated = date.format(new Date(article.updatedAt));
  const html = articleHtml(article.body, lang);

  return (
    <article>
      <PageHero photo={cover ?? HERO_IMAGES[(day + 4) % HERO_IMAGES.length] ?? null} title={article.title} subtitle={article.excerpt}>
        <p className="flex flex-wrap gap-x-3 text-base text-paper/85">
          <time dateTime={article.publishedAt}>{t("publishedOn", { date: published })}</time>
          {updated !== published && (
            <time dateTime={article.updatedAt}>{t("updatedOn", { date: updated })}</time>
          )}
          {article.author && <span>{t("byAuthor", { name: article.author })}</span>}
        </p>
      </PageHero>

      <div className="mx-auto max-w-3xl space-y-10 px-4 pb-10 pt-8">
        <div className="article-body" dangerouslySetInnerHTML={{ __html: html }} />

        <ShareButtons url={pageUrl(articlePath(article.slug), lang)} title={article.title} />

        {article.sources.length > 0 && (
          <section aria-labelledby="article-sources" className="card-elevated space-y-3 p-5">
            <h2 id="article-sources" className="flex items-center gap-2 text-2xl">
              <BookOpen aria-hidden="true" className="h-6 w-6 shrink-0 text-brand" />
              {t("sourcesTitle")}
            </h2>
            <p className="text-muted">{t("sourcesIntro")}</p>
            <ul className="space-y-2">
              {article.sources.map((s, i) => (
                <li key={i} className="leading-relaxed">
                  <span className="font-semibold">{t("sourceRef", { vol: s.vol, page: s.page })}</span>
                  {s.note && (
                    <span className="text-muted">
                      {" — "}
                      <bdi>{s.note}</bdi>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {places.length > 0 && (
          <section aria-labelledby="article-places" className="space-y-4">
            <h2 id="article-places" className="text-2xl">
              {t("placesTitle")}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {places.map((p) => (
                <PlaceCard key={p.slug} place={toPlaceCardData(p)} compact />
              ))}
            </div>
          </section>
        )}

        {linkedJourneys.length > 0 && (
          <section aria-labelledby="article-journeys" className="space-y-4">
            <h2 id="article-journeys" className="text-2xl">
              {t("journeysTitle")}
            </h2>
            <ul className="space-y-3">
              {linkedJourneys.map((j) => {
                const { title, subtitle } = journeyTexts(j, lang);
                return (
                  <li key={j.slug}>
                    <Link
                      href={`/journeys/${encodeURIComponent(j.slug)}`}
                      className="card-elevated card-lift flex min-h-20 items-center gap-4 p-5"
                    >
                      <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-brand">
                        <Route className="h-6 w-6" />
                      </span>
                      <span className="min-w-0 flex-1 space-y-1">
                        <span className="block text-xl font-semibold">{title}</span>
                        <span className="block text-muted">
                          {tj("stopsCount", { count: j.stops.length })}
                          {subtitle ? ` · ${subtitle}` : ""}
                        </span>
                      </span>
                      <ChevronLeft aria-hidden="true" className="h-6 w-6 shrink-0 text-brand ltr:-scale-x-100" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {more.length > 0 && (
          <section aria-labelledby="article-more" className="space-y-4">
            <h2 id="article-more" className="text-2xl">
              {t("moreTitle")}
            </h2>
            <ul className="divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-surface">
              {more.map((a) => (
                <li key={a.slug}>
                  <Link href={`/blog/${a.slug}`} className="flex min-h-16 flex-col justify-center gap-0.5 px-5 py-3">
                    <span className="text-lg font-semibold">{a.title}</span>
                    <time dateTime={a.publishedAt} className="text-sm text-muted">
                      {date.format(new Date(a.publishedAt))}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Link href="/blog" className="inline-flex min-h-12 items-center gap-2 rounded-2xl border-[1.5px] border-ink/30 px-5 font-medium">
          <ChevronLeft aria-hidden="true" className="h-5 w-5 shrink-0 rtl:-scale-x-100" />
          {t("allArticles")}
        </Link>
      </div>

      <JsonLd data={articleJsonLd(article, lang, places)} />
    </article>
  );
}

/**
 * schema.org Article for search engines: headline, dates, language, image,
 * publisher, and the places it is about — each by its site-wide entity @id
 * ("<site>/places/<slug>#place"), the same node the place page describes.
 */
function articleJsonLd(article: Article, lang: Lang, places: PlaceWithMedia[]) {
  const url = pageUrl(articlePath(article.slug), lang);
  const organization = {
    "@type": "Organization",
    "@id": organizationId(),
    name: SITE_NAME_EN,
    alternateName: SITE_NAME,
    url: absoluteUrl("/"),
    logo: { "@type": "ImageObject", url: absoluteUrl("/icons/icon-512.png"), width: 512, height: 512 },
  };
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: description(article),
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    inLanguage: lang,
    image: [absoluteUrl(shareImage(article, places).url)],
    author: article.author ? { "@type": "Person", name: article.author } : organization,
    publisher: organization,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
    ...(article.tags.length ? { keywords: article.tags.join(", ") } : {}),
    ...(places.length ? { about: places.map((p) => placeRef({ slug: p.slug, name: p.name_ar, category: p.category }, lang)) } : {}),
  };
}

/** /en for an article that exists only in Arabic so far. */
async function NotInEnglish({ article }: { article: Article }) {
  const t = await getTranslations("blog");
  const day = Math.floor(Date.now() / 86_400_000);
  return (
    <>
      <PageHero photo={articleCover(article.coverUrl) ?? HERO_IMAGES[(day + 4) % HERO_IMAGES.length] ?? null} title={t("title")} />
      <div className="mx-auto max-w-3xl px-4 pb-10 pt-8">
        <div className="card-elevated space-y-4 p-6 text-lg">
          {/* Without an English version the title is the Arabic one: marked as Arabic. */}
          <h2 className="text-2xl" {...(article.titleLang === "ar" ? { lang: "ar", dir: "rtl" } : {})}>
            {article.title}
          </h2>
          <p className="text-muted">{t("notInEnglish")}</p>
          <div className="flex flex-wrap gap-3">
            {/* next/link, not the localizing Link: this one must stay on the Arabic URL. */}
            <NextLink
              href={articlePath(article.slug)}
              hrefLang="ar"
              className="inline-flex min-h-12 items-center rounded-2xl bg-primary px-5 font-semibold text-paper"
            >
              {t("openArabic")}
            </NextLink>
            <Link href="/blog" className="inline-flex min-h-12 items-center rounded-2xl border-[1.5px] border-ink/30 px-5 font-medium">
              {t("allArticles")}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
