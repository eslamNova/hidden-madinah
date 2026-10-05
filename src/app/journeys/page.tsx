import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Clock, Footprints } from "lucide-react";
import { coverImage, stripVerify } from "@/lib/content";
import { HERO_IMAGES } from "@/lib/hero-images";
import { getPublishedJourneys } from "@/lib/queries";
import { PageHero } from "@/components/layout/PageHero";
import { PlaceImage, PlaceholderImage } from "@/components/place/PlaceImage";

export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("journey");
  return { title: t("listTitle"), description: t("listSubtitle") };
}

export default async function JourneysPage() {
  const t = await getTranslations("journey");
  const journeys = await getPublishedJourneys();
  const day = Math.floor(Date.now() / 86_400_000);
  const heroPhoto =
    coverImage(journeys[0]?.stops.flatMap((s) => s.place?.media ?? []) ?? []) ??
    HERO_IMAGES[(day + 1) % HERO_IMAGES.length] ??
    null;

  return (
    <>
      <PageHero photo={heroPhoto} title={t("listTitle")} subtitle={t("listSubtitle")}>
        <Link href="/my-journey" className="mt-2 inline-flex min-h-11 items-center rounded-full bg-paper/15 px-4 font-medium text-paper">
          {t("myJourney")}
        </Link>
      </PageHero>
      <div className="mx-auto max-w-3xl space-y-5 px-4 pb-8 pt-8">
        {journeys.length === 0 ? (
          <p className="card-elevated p-8 text-center text-lg text-muted">{t("listEmpty")}</p>
        ) : (
          journeys.map((j) => {
            const cover = coverImage(j.stops.flatMap((s) => s.place?.media ?? []));
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
                      <span className="flex items-center gap-1 ltr-nums">
                        <Clock aria-hidden="true" className="h-4 w-4" />
                        {t("duration", { min: j.duration_min })}
                      </span>
                    )}
                  </span>
                  <h2 className="text-2xl text-paper">{j.title_ar}</h2>
                  {j.subtitle_ar && (
                    <p className="line-clamp-2 text-base leading-relaxed text-paper/80">{stripVerify(j.subtitle_ar)}</p>
                  )}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </>
  );
}
