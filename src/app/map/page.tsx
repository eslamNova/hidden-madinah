import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MapView } from "@/components/map/MapView";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("map");
  return { title: t("title") };
}

export default function MapPage() {
  // Full-bleed map: cancel the root layout's bottom padding.
  return (
    <div className="-mb-28">
      <MapView />
    </div>
  );
}