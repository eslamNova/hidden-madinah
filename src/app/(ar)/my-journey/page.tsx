import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { HERO_IMAGES } from "@/lib/hero-images";
import { getPublishedJourneys, getPublishedPlaces } from "@/lib/queries";
import { PageHero } from "@/components/layout/PageHero";
import { MyJourney } from "@/components/journey/MyJourney";

export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("journey");
  return { title: t("myJourney"), robots: { index: false } };
}

export default async function MyJourneyPage() {
  const t = await getTranslations("journey");
  const [places, journeys] = await Promise.all([getPublishedPlaces(), getPublishedJourneys()]);
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
