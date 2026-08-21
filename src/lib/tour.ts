import { coverImage, stripVerify } from "@/lib/content";
import type { PlaceWithMedia } from "@/lib/queries";
import type { TourSlide } from "@/components/tour/TourViewer";

/**
 * Flattens places into tour slides — each media item with its place context,
 * media in curated sort order. Shared by the site-wide /tour and the
 * per-place /places/[slug]/tour.
 */
export function toTourSlides(places: PlaceWithMedia[]): TourSlide[] {
  return places.flatMap((p) => {
    const summary = stripVerify(p.summary_ar);
    return p.media.flatMap((m): TourSlide[] => {
      if (m.type === "photo" && (!m.width || !m.height)) return [];
      return [
        {
          id: m.id,
          kind: m.type,
          url: m.url,
          poster: m.type === "video" ? coverImage([m]) : null,
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
}
