import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getJourney, getJourneySlugs, getPublishedJourneys } from "@/lib/queries";
import { toPlayerJourney } from "@/lib/journey-view";
import { PageHero } from "@/components/layout/PageHero";
import { JourneyPlayer } from "@/components/journey/JourneyPlayer";

export const revalidate = 86400;

export async function generateStaticParams() {
  const slugs = await getJourneySlugs();
  return slugs.map((slug) => ({ slug }));
}

async function load(rawSlug: string) {
  const journey = await getJourney(decodeURIComponent(rawSlug));
  return journey && journey.is_published ? journey : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const journey = await load(slug);
  return journey ? { title: journey.title_ar, description: journey.subtitle_ar ?? undefined } : {};
}

export default async function JourneyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const journey = await load(slug);
  // RLS hides unverified stops: a journey with none visible isn't ready.
  if (!journey || journey.stops.length === 0) notFound();

  const view = toPlayerJourney(journey, "ar");
  const others = (await getPublishedJourneys())
    .filter((j) => j.slug !== journey.slug)
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
