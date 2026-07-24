import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { stripVerify } from "@/lib/content";
import { getPublishedPlaces } from "@/lib/queries";
import { toPlaceCardData } from "@/components/place/PlaceCard";
import {
  PlacesExplorer,
  type ExplorerPlace,
} from "@/components/place/PlacesExplorer";

export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("places");
  return { title: t("title") };
}

export default async function PlacesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const t = await getTranslations("places");
  const places = await getPublishedPlaces();

  // Lean, [VERIFY]-free DTOs only — nothing owner-internal reaches the client.
  const dtos: ExplorerPlace[] = places.map((p) => ({
    ...toPlaceCardData(p),
    bestTime: stripVerify(p.best_time_ar),
    driveTimeMin: p.drive_time_from_haram_min,
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <h1 className="text-3xl">{t("title")}</h1>
      <PlacesExplorer places={dtos} initialCategory={category} />
    </div>
  );
}