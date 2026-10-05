import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { languageAlternates, type Lang } from "@/lib/i18n";
import { getPublishedPlaces } from "@/lib/queries";
import { nabawiSlides, toTourSlides } from "@/lib/tour";
import { TourViewer } from "@/components/tour/TourViewer";

/** /tour and /en/tour. The route files set the request locale before rendering. */
export async function tourMetadata(lang: Lang): Promise<Metadata> {
  const t = await getTranslations("tour");
  return { title: t("title"), alternates: languageAlternates("/tour", lang) };
}

/**
 * الجولة المصوّرة — opens with the المسجد النبوي chapter (static manifest,
 * not a place), then every published place's media ordered like the places
 * list (featured first, then by distance).
 */
export async function TourView({ lang }: { lang: Lang }) {
  const t = await getTranslations("tour");
  const places = await getPublishedPlaces(lang);
  const slides = [
    ...nabawiSlides(t("nabawiName"), t("nabawiSummary")),
    ...toTourSlides(places),
  ];

  // -mb-28 cancels the layout's pb-28: the tour owns the whole viewport
  // (dock and the أ control both hide themselves on tour routes). The exit
  // href is the Arabic path; Link localizes it ("/" → "/en").
  return (
    <div className="-mb-28">
      <TourViewer slides={slides} exitHref="/" />
    </div>
  );
}
