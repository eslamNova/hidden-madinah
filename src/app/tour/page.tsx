import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { coverImage, stripVerify } from "@/lib/content";
import { getPublishedPlaces } from "@/lib/queries";
import { TourViewer, type TourSlide } from "@/components/tour/TourViewer";

export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tour");
  return { title: t("title") };
}

/**
 * الجولة المصوّرة — every published place's media as one full-screen stream,
 * ordered like the places list (featured first, then by distance), each
 * place's media in its curated sort order.
 */
export default async function TourPage() {
  const places = await getPublishedPlaces();

  const slides: TourSlide[] = places.flatMap((p) => {
    const summary = stripVerify(p.summary_ar);
    return p.media.flatMap((m): TourSlide[] => {
      if (m.type === "photo" && (!m.width || !m.height)) return [];
      return [
        {
          id: m.id,
          kind: m.type,
          url: m.url,
          poster:
            m.type === "video"
              ? coverImage([m])
              : null,
          width: m.width ?? 1600,
          height: m.height ?? 1200,
          caption: stripVerify(m.caption_ar),
          placeName: p.name_ar,
          placeSlug: p.slug,
          category: p.category,
          summary,
        },
      ];
    });
  });

  // -mb-28 cancels the layout's pb-28: the tour owns the whole viewport
  // (dock and the أ control both hide themselves on /tour).
  return (
    <div className="-mb-28">
      <TourViewer slides={slides} />
    </div>
  );
}
