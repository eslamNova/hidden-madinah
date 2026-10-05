import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { stripVerify } from "@/lib/content";
import { HERO_IMAGES } from "@/lib/hero-images";
import { languageAlternates, type Lang } from "@/lib/i18n";
import { getPublishedPlaces } from "@/lib/queries";
import { PageHero } from "@/components/layout/PageHero";
import { toPlaceCardData } from "@/components/place/PlaceCard";
import {
  NearestPlaces,
  type NearestPlaceInput,
} from "@/components/place/NearestPlaces";
import {
  PlacesExplorer,
  type ExplorerPlace,
} from "@/components/place/PlacesExplorer";
import { TelegramCard } from "@/components/place/TelegramCard";

/** /places and /en/places. The route files set the request locale before rendering. */
export async function placesMetadata(lang: Lang): Promise<Metadata> {
  const t = await getTranslations("places");
  return { title: t("title"), alternates: languageAlternates("/places", lang) };
}

export async function PlacesView({ lang }: { lang: Lang }) {
  const t = await getTranslations("places");
  const tCommon = await getTranslations("common");
  const places = await getPublishedPlaces(lang);

  // Same daily rotation as the landing, offset so the two never show the
  // same Nabawi frame on the same day.
  const day = Math.floor(Date.now() / 86_400_000);
  const heroPhoto = HERO_IMAGES[(day + 2) % HERO_IMAGES.length] ?? null;

  // Lean, [VERIFY]-free DTOs only — nothing owner-internal reaches the client.
  const dtos: ExplorerPlace[] = places.map((p) => ({
    ...toPlaceCardData(p),
    bestTime: stripVerify(p.best_time_ar),
    driveTimeMin: p.drive_time_from_haram_min,
  }));

  const nearestInput: NearestPlaceInput[] = places
    .filter((p) => p.lat != null && p.lng != null)
    .map((p) => ({
      slug: p.slug,
      name_ar: p.name_ar,
      category: p.category,
      lat: Number(p.lat),
      lng: Number(p.lng),
    }));

  return (
    <>
      <PageHero
        photo={heroPhoto}
        title={t("title")}
        subtitle={tCommon("tagline")}
        innerClassName="max-w-5xl"
      />
      <div className="mx-auto max-w-5xl space-y-10 px-4 pb-8 pt-8">
        {/* Suspense: PlacesExplorer reads ?category= via useSearchParams. */}
        <Suspense>
          <PlacesExplorer places={dtos} />
        </Suspense>
        {/* Geolocation on explicit request only (moved from the story landing). */}
        <NearestPlaces places={nearestInput} />
        <TelegramCard />
      </div>
    </>
  );
}
