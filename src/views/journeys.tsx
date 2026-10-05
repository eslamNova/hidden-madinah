import type { Metadata } from "next";
import NextLink from "next/link";
import Link from "@/components/i18n/Link";
import { getTranslations } from "next-intl/server";
import { Clock, Footprints } from "lucide-react";
import { coverImage } from "@/lib/content";
import { HERO_IMAGES } from "@/lib/hero-images";
import { languageAlternates, type Lang } from "@/lib/i18n";
import { hasEnglishVersion, journeyTexts } from "@/lib/journey-view";
import { getPublishedJourneys } from "@/lib/queries";
import { PageHero } from "@/components/layout/PageHero";
import { PlaceImage, PlaceholderImage } from "@/components/place/PlaceImage";

/**
 * /journeys and /en/journeys. The route files set the request locale before
 * rendering. English lists only the journeys that have an English version;
 * the rest stay one tap away in Arabic.
 */
export async function journeysMetadata(lang: Lang): Promise<Metadata> {
  const t = await getTranslations("journey");
  return { title: t("listTitle"), description: t("listSubtitle"), alternates: languageAlternates("/journeys", lang) };
}

export async function JourneysView({ lang }: { lang: Lang }) {
  const t = await getTranslations("journey");
  const tp = await getTranslations("plan");
  const all = await getPublishedJourneys(lang);
  const journeys = lang === "en" ? all.filter(hasEnglishVersion) : all;
  const arabicOnly = all.length - journeys.length;
  const day = Math.floor(Date.now() / 86_400_000);
  const heroPhoto =
    coverImage(journeys[0]?.stops.flatMap((s) => s.place?.media ?? []) ?? []) ??
    HERO_IMAGES[(day + 1) % HERO_IMAGES.length] ??
    null;

  // next/link, not the localizing Link: this one must stay on the Arabic URL.
  const arabicLink = (
    <NextLink href="/journeys" hrefLang="ar" className="font-semibold text-brand underline">
      {t("openArabic")}
    </NextLink>
  );

  return (
    <>
      <PageHero photo={heroPhoto} title={t("listTitle")} subtitle={t("listSubtitle")}>
        <div className="mt-2 flex flex-wrap gap-2">
          <Link href="/plan" className="inline-flex min-h-11 items-center rounded-full bg-accent px-4 font-semibold text-basalt">
            {tp("cta")}
          </Link>
          <Link href="/my-journey" className="inline-flex min-h-11 items-center rounded-full bg-paper/15 px-4 font-medium text-paper">
            {t("myJourney")}
          </Link>
        </div>
      </PageHero>
      <div className="mx-auto max-w-3xl space-y-5 px-4 pb-8 pt-8">
        {journeys.length === 0 ? (
          arabicOnly > 0 ? (
            <div className="card-elevated space-y-3 p-8 text-center text-lg">
              <p className="text-muted">{t("listNotInEnglish")}</p>
              <p>{arabicLink}</p>
            </div>
          ) : (
            <p className="card-elevated p-8 text-center text-lg text-muted">{t("listEmpty")}</p>
          )
        ) : (
          journeys.map((j) => {
            const cover = coverImage(j.stops.flatMap((s) => s.place?.media ?? []));
            const { title, subtitle } = journeyTexts(j, lang);
            return (
              <Link
                key={j.id}
                href={`/journeys/${encodeURIComponent(j.slug)}`}
                className="card-lift relative block overflow-hidden rounded-2xl bg-basalt shadow-md"
              >
                {cover ? (
                  <PlaceImage media={cover} alt="" sizes="(max-width: 768px) 92vw, 720px" className="aspect-[16/9] w-full object-cover" />
                ) : (
                  <PlaceholderImage category="mosque" className="aspect-[16/9] w-full" />
                )}
                <div aria-hidden="true" className="scrim absolute inset-0" />
                <div className="absolute inset-x-0 bottom-0 space-y-1 p-5">
                  <span className="flex flex-wrap items-center gap-x-3 text-sm font-medium text-accent">
                    <span className="flex items-center gap-1">
                      <Footprints aria-hidden="true" className="h-4 w-4" />
                      {t("stopsCount", { count: j.stops.length })}
                    </span>
                    {j.duration_min && (
                      <span className="flex items-center gap-1">
                        <Clock aria-hidden="true" className="h-4 w-4" />
                        <span>{t("duration", { min: j.duration_min })}</span>
                      </span>
                    )}
                  </span>
                  <h2 className="text-2xl text-paper">{title}</h2>
                  {subtitle && <p className="line-clamp-2 text-base leading-relaxed text-paper/80">{subtitle}</p>}
                </div>
              </Link>
            );
          })
        )}
        {journeys.length > 0 && arabicOnly > 0 && (
          <p className="text-center text-muted">
            {t("moreInArabic")} {arabicLink}
          </p>
        )}
      </div>
    </>
  );
}
