import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getTranslations } from "next-intl/server";
import { BookOpen, Heart, ScrollText } from "lucide-react";
import Link from "@/components/i18n/Link";
import { ogImageOf } from "@/lib/article-format";
import { parseSamarrai } from "@/lib/citations";
import { coverImage } from "@/lib/content";
import type { Lang } from "@/lib/i18n";
import { hasEnglishVersion, journeyTexts, toPlayerJourney, type PlayerJourney, type StopSource } from "@/lib/journey-view";
import { pageMetadata, shareImageOf } from "@/lib/page-metadata";
import { getJourney, getJourneySlugs, getPublishedJourneys, type JourneyFull } from "@/lib/queries";
import { jsonLdGraph, touristTripNode, wafaBookNode } from "@/lib/structured-data";
import { PageHero } from "@/components/layout/PageHero";
import { JourneyPlayer } from "@/components/journey/JourneyPlayer";
import { JsonLd } from "@/components/seo/JsonLd";

/**
 * /journeys/[slug] and /en/journeys/[slug]. The route files set the request
 * locale before rendering. getJourney(slug, { lang }) returns the rows with the
 * visitor's language already in the display columns, and toPlayerJourney gets
 * the same lang — the one place both are decided, so nothing is localized twice.
 *
 * A journey without a complete English version (English title and narration
 * for every stop) is not shown half-translated on /en: the page says so and
 * links to the Arabic, and it is kept out of search engines and hreflang.
 */

type Params = Promise<{ slug: string }>;

export async function journeyStaticParams() {
  const slugs = await getJourneySlugs();
  return slugs.map((slug) => ({ slug }));
}

// generateMetadata and the page read the same rows: once per request.
const load = cache(async (rawSlug: string, lang: Lang) => {
  const journey = await getJourney(decodeURIComponent(rawSlug), { lang });
  return journey && journey.is_published ? journey : null;
});

const journeyPath = (slug: string) => `/journeys/${encodeURIComponent(slug)}`;

/** The first stop photo (else a video poster): the share image and the structured data's image. */
const journeyCover = (journey: JourneyFull) => coverImage(journey.stops.flatMap((s) => s.place?.media ?? []));

export async function journeyMetadata(lang: Lang, params: Params): Promise<Metadata> {
  const { slug } = await params;
  const journey = await load(slug, lang);
  if (!journey) return {};
  const path = journeyPath(journey.slug);
  const { title, subtitle } = journeyTexts(journey, lang);
  const image = shareImageOf(journeyCover(journey), title);
  if (!hasEnglishVersion(journey)) {
    // No English twin: one canonical Arabic page, and /en stays out of the index.
    const t = await getTranslations("journey");
    return pageMetadata({
      lang,
      path,
      title: lang === "en" && !journey.title_en?.trim() ? t("listTitle") : title,
      description: subtitle,
      image,
      bilingual: false,
      noindex: lang === "en",
    });
  }
  return pageMetadata({ lang, path, title, description: subtitle, image });
}

export async function JourneyView({ lang, params }: { lang: Lang; params: Params }) {
  const { slug } = await params;
  const journey = await load(slug, lang);
  // RLS hides unverified stops: a journey with none visible isn't ready.
  if (!journey || journey.stops.length === 0) notFound();

  if (lang === "en" && !hasEnglishVersion(journey)) return <NotInEnglish journey={journey} />;

  const view = toPlayerJourney(journey, lang);
  const others = (await getPublishedJourneys(lang))
    .filter((j) => j.slug !== journey.slug && (lang === "ar" || hasEnglishVersion(j)))
    .slice(0, 3)
    .map((j) => ({ slug: j.slug, title: j.title_ar }));

  const cover = journeyCover(journey);

  return (
    <>
      <PageHero photo={view.cover} title={view.title} subtitle={view.subtitle} />
      <div className="mx-auto max-w-3xl space-y-8 px-4 pb-10 pt-8">
        <JourneyPlayer journey={view} others={others} />
        <JourneyFullText journey={view} />
      </div>
      <JsonLd
        data={jsonLdGraph(
          touristTripNode({
            lang,
            path: journeyPath(journey.slug),
            name: view.title,
            description: view.subtitle ?? view.intro,
            image: cover ? ogImageOf(cover) : null,
            stops: journey.stops.map((s, i) => ({
              name: view.stops[i]?.title ?? "",
              place: s.place ? { slug: s.place.slug, category: s.place.category } : null,
            })),
          }),
          wafaBookNode(lang)
        )}
      />
    </>
  );
}

/**
 * «النص الكامل للرحلة» — every stop's narration, human moment and sources,
 * rendered on the server below the player. The player shows one stop at a
 * time (client state), so without this the journey's text would not be in
 * the page's HTML at all. Collapsed by default: the player stays the way in.
 */
async function JourneyFullText({ journey }: { journey: PlayerJourney }) {
  const t = await getTranslations("journey");
  const tc = await getTranslations("common");
  const lang = journey.lang;
  const stops = journey.stops.filter((s) => s.script || s.humanMoment);
  if (stops.length === 0) return null;

  const sourceLine = (s: StopSource) => {
    const samarrai = s.samarrai ? parseSamarrai(s.samarrai) : null;
    const hadith = s.hadith ? `${s.hadith}${s.grading ? ` (${s.grading})` : ""}` : null;
    return (
      <>
        {t("sourceRef", { vol: s.vol ?? "?", page: s.page ?? "?" })}
        {s.samarrai &&
          (lang === "ar" ? (
            ` · ${t("samarraiRef", { ref: s.samarrai })}`
          ) : (
            <>
              {" · "}
              {samarrai ? t("samarraiVolPage", samarrai) : <bdi lang="ar">{t("samarraiRef", { ref: s.samarrai })}</bdi>}
            </>
          ))}
        {hadith &&
          (lang === "ar" ? (
            ` · ${hadith}`
          ) : (
            // Narration references stay as written in the source (Arabic).
            <>
              {" · "}
              <bdi lang="ar">{hadith}</bdi>
            </>
          ))}
      </>
    );
  };

  return (
    <details className="rounded-2xl border border-ink/10 bg-surface p-4">
      <summary className="flex min-h-12 cursor-pointer items-center gap-2 text-lg font-semibold">
        <ScrollText aria-hidden="true" className="h-5 w-5 shrink-0 text-brand" />
        {t("fullText")}
      </summary>
      <div className="mt-4 space-y-8">
        <p className="text-muted">{t("fullTextIntro")}</p>
        {stops.map((s) => (
          <section key={s.order} aria-labelledby={`full-stop-${s.index}`} className="space-y-3">
            <h3 id={`full-stop-${s.index}`} className="text-xl leading-snug">
              <span className="font-semibold text-brand">{t("stopOf", { n: s.index, total: journey.stops.length })}</span>
              {" — "}
              {s.placeSlug ? (
                <Link
                  href={`/places/${encodeURIComponent(s.placeSlug)}`}
                  className="underline decoration-brand/30 underline-offset-4 hover:decoration-brand"
                >
                  {s.title}
                </Link>
              ) : (
                s.title
              )}
            </h3>
            {s.script && <p className="whitespace-pre-line text-lg leading-loose">{s.script}</p>}
            {s.humanMoment && (
              <aside className="flex gap-3 rounded-2xl border-[1.5px] border-accent/60 bg-sand/60 p-4">
                <Heart aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-accent" />
                <div>
                  <h4 className="font-semibold">{t("humanMoment")}</h4>
                  <p className="leading-relaxed">{s.humanMoment}</p>
                </div>
              </aside>
            )}
            {s.sources.length > 0 && (
              <div className="space-y-2">
                <h4 className="flex items-center gap-2 font-semibold">
                  <BookOpen aria-hidden="true" className="h-5 w-5 shrink-0" />
                  {t("sourcesCount", { count: s.sources.length })}
                </h4>
                <ol className="space-y-2 text-sm">
                  {s.sources.map((src, i) => (
                    <li key={src.id} className="leading-relaxed">
                      <span className="font-bold ltr-nums">[{i + 1}]</span>{" "}
                      {src.textLang === lang ? (
                        src.text
                      ) : (
                        <span lang={src.textLang} dir={src.textLang === "ar" ? "rtl" : "ltr"}>
                          {src.text}
                        </span>
                      )}
                      <span className="block text-muted">{sourceLine(src)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>
        ))}
        {lang === "en" && <p className="text-sm text-muted">{tc("translationNote")}</p>}
        <Link href="/sources" className="inline-flex min-h-11 items-center font-medium text-brand underline underline-offset-4">
          {t("fullTextMethod")}
        </Link>
      </div>
    </details>
  );
}

/** /en for a journey that exists only in Arabic so far. */
async function NotInEnglish({ journey }: { journey: JourneyFull }) {
  const t = await getTranslations("journey");
  const cover = toPlayerJourney(journey, "en").cover;
  return (
    <>
      <PageHero photo={cover} title={t("listTitle")} />
      <div className="mx-auto max-w-3xl px-4 pb-10 pt-8">
        <div className="card-elevated space-y-4 p-6 text-lg">
          {/* Without an English name the title is the Arabic one: marked as Arabic. */}
          <h2 className="text-2xl" {...(journey.title_en?.trim() ? {} : { lang: "ar", dir: "rtl" })}>
            {journey.title_ar}
          </h2>
          <p className="text-muted">{t("notInEnglish")}</p>
          <div className="flex flex-wrap gap-3">
            {/* next/link, not the localizing Link: this one must stay on the Arabic URL. */}
            <NextLink
              href={journeyPath(journey.slug)}
              hrefLang="ar"
              className="inline-flex min-h-12 items-center rounded-2xl bg-primary px-5 font-semibold text-paper"
            >
              {t("openArabic")}
            </NextLink>
            <Link href="/journeys" className="inline-flex min-h-12 items-center rounded-2xl border-[1.5px] border-ink/30 px-5 font-medium">
              {t("listTitle")}
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
