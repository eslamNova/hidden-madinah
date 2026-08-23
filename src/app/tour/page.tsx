import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getPublishedPlaces } from "@/lib/queries";
import { nabawiSlides, toTourSlides } from "@/lib/tour";
import { TourViewer } from "@/components/tour/TourViewer";

export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tour");
  return { title: t("title") };
}

/**
 * الجولة المصوّرة — opens with the المسجد النبوي chapter (static manifest,
 * not a place), then every published place's media ordered like the places
 * list (featured first, then by distance).
 */
export default async function TourPage() {
  const t = await getTranslations("tour");
  const places = await getPublishedPlaces();
  const slides = [
    ...nabawiSlides(t("nabawiName"), t("nabawiSummary")),
    ...toTourSlides(places),
  ];

  // -mb-28 cancels the layout's pb-28: the tour owns the whole viewport
  // (dock and the أ control both hide themselves on tour routes).
  return (
    <div className="-mb-28">
      <TourViewer slides={slides} exitHref="/" />
    </div>
  );
}
