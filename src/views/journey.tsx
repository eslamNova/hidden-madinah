import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "@/components/i18n/Link";
import { languageAlternates, type Lang } from "@/lib/i18n";
import { hasEnglishVersion, journeyTexts, toPlayerJourney } from "@/lib/journey-view";
import { getJourney, getJourneySlugs, getPublishedJourneys, type JourneyFull } from "@/lib/queries";
import { PageHero } from "@/components/layout/PageHero";
import { JourneyPlayer } from "@/components/journey/JourneyPlayer";

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

async function load(rawSlug: string, lang: Lang) {
  const journey = await getJourney(decodeURIComponent(rawSlug), { lang });
  return journey && journey.is_published ? journey : null;
}

const journeyPath = (slug: string) => `/journeys/${encodeURIComponent(slug)}`;

export async function journeyMetadata(lang: Lang, params: Params): Promise<Metadata> {
  const { slug } = await params;
  const journey = await load(slug, lang);
  if (!journey) return {};
  const path = journeyPath(journey.slug);
  const { title, subtitle } = journeyTexts(journey, lang);
  if (!hasEnglishVersion(journey)) {
    // No English twin: one canonical Arabic page, and /en stays out of the index.
    const t = await getTranslations("journey");
    return {
      title: lang === "en" && !journey.title_en?.trim() ? t("listTitle") : title,
      description: subtitle ?? undefined,
      alternates: { canonical: path },
      ...(lang === "en" ? { robots: { index: false } } : {}),
    };
  }
  return { title, description: subtitle ?? undefined, alternates: languageAlternates(path, lang) };
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

  return (
    <>
      <PageHero photo={view.cover} title={view.title} subtitle={view.subtitle} />
      <div className="mx-auto max-w-3xl px-4 pb-10 pt-8">
        <JourneyPlayer journey={view} others={others} />
      </div>
    </>
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
