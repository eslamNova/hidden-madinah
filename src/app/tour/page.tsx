import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getPublishedPlaces } from "@/lib/queries";
import { toTourSlides } from "@/lib/tour";
import { TourViewer } from "@/components/tour/TourViewer";

export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tour");
  return { title: t("title") };
}

/**
 * الجولة المصوّرة — every published place's media as one full-screen stream,
 * ordered like the places list (featured first, then by distance).
 */
export default async function TourPage() {
  const places = await getPublishedPlaces();

  // -mb-28 cancels the layout's pb-28: the tour owns the whole viewport
  // (dock and the أ control both hide themselves on tour routes).
  return (
    <div className="-mb-28">
      <TourViewer slides={toTourSlides(places)} exitHref="/" />
    </div>
  );
}
