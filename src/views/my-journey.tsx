import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { HERO_IMAGES } from "@/lib/hero-images";
import { languageAlternates, type Lang } from "@/lib/i18n";
import { hasEnglishVersion } from "@/lib/journey-view";
import { getPublishedJourneys, getPublishedPlaces } from "@/lib/queries";
import { PageHero } from "@/components/layout/PageHero";
import { MyJourney } from "@/components/journey/MyJourney";

/**
 * /my-journey and /en/my-journey. The route files set the request locale
 * before rendering. The page is static and identical for everyone: what the
 * device visited is read on the device (MyJourney). English lists the journeys
 * that have an English version, the same ones /en/journeys offers.
 */
export async function myJourneyMetadata(lang: Lang): Promise<Metadata> {
  const t = await getTranslations("journey");
  return { title: t("myJourney"), robots: { index: false }, alternates: languageAlternates("/my-journey", lang) };
}

export async function MyJourneyView({ lang }: { lang: Lang }) {
  const t = await getTranslations("journey");
  const [places, all] = await Promise.all([getPublishedPlaces(lang), getPublishedJourneys(lang)]);
  const journeys = lang === "en" ? all.filter(hasEnglishVersion) : all;
  const day = Math.floor(Date.now() / 86_400_000);

  return (
    <>
      <PageHero photo={HERO_IMAGES[(day + 2) % HERO_IMAGES.length] ?? null} title={t("myJourney")} subtitle={t("myJourneySubtitle")} />
      <div className="mx-auto max-w-3xl px-4 pb-10 pt-8">
        <MyJourney
          places={places.map((p) => ({ slug: p.slug, name: p.name_ar }))}
          journeys={journeys.map((j) => ({
            slug: j.slug,
            title: j.title_ar,
            stops: j.stops.length,
            placeSlugs: j.stops.flatMap((s) => (s.place ? [s.place.slug] : [])),
          }))}
        />
      </div>
    </>
  );
}
