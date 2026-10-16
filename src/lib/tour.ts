import { getTranslations } from "next-intl/server";
import { coverImage, stripVerify } from "@/lib/content";
import type { Lang } from "@/lib/i18n";
import { NABAWI_MEDIA } from "@/lib/nabawi-media";
import type { PlaceWithMedia } from "@/lib/queries";
import { pageUrl, videoNode, type JsonLdNode } from "@/lib/structured-data";
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
          durationSeconds: m.duration_seconds ?? null,
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

/**
 * The المسجد النبوي opening chapter of the site-wide tour — static manifest
 * media (no place row, so it never shows up in the places list or map).
 */
export function nabawiSlides(name: string, summary: string): TourSlide[] {
  return NABAWI_MEDIA.map((m, i) => ({
    id: `nabawi-${i}`,
    kind: m.kind,
    url: m.url,
    poster: m.poster ? { url: m.poster, width: m.width, height: m.height, singleVariant: true } : null,
    width: m.width,
    height: m.height,
    durationSeconds: m.durationSeconds ?? null,
    caption: null,
    placeName: name,
    placeSlug: null,
    category: "mosque",
    summary,
  }));
}

/** One video of a tour, described for search engines (VideoObject, video sitemap). */
export type TourVideo = {
  id: string;
  /** Unique on the page: "<place> — video n". */
  name: string;
  description: string;
  thumbnailUrl: string;
  contentUrl: string;
  durationSeconds: number | null;
  placeSlug: string | null;
};

/**
 * A tour's videos: a unique name per video, its caption or its place's
 * summary as the description (else the page's), the poster frame, the MP4 and
 * its stored duration. Slides come from toTourSlides / nabawiSlides, which
 * already strip [VERIFY] markers.
 */
export function tourVideos(
  slides: TourSlide[],
  videoName: (placeName: string, n: number) => string,
  fallbackDescription: string
): TourVideo[] {
  const seen = new Map<string, number>();
  return slides.flatMap((s) => {
    if (s.kind !== "video" || !s.poster) return [];
    const n = (seen.get(s.placeName) ?? 0) + 1;
    seen.set(s.placeName, n);
    return [
      {
        id: s.id,
        name: videoName(s.placeName, n),
        description: s.caption ?? s.summary ?? fallbackDescription,
        thumbnailUrl: s.poster.url,
        contentUrl: s.url,
        durationSeconds: s.durationSeconds,
        placeSlug: s.placeSlug,
      },
    ];
  });
}

/**
 * schema.org VideoObjects for a tour page's videos.
 *
 * uploadDate is left out: media rows store no upload time, and a made-up
 * date would be worse than none (a media.created_at column would fill it).
 */
export async function tourVideoNodes(
  slides: TourSlide[],
  arPath: string,
  lang: Lang,
  fallbackDescription: string
): Promise<JsonLdNode[]> {
  const t = await getTranslations("tour");
  const url = pageUrl(arPath, lang);
  return tourVideos(slides, (name, n) => t("videoName", { name, n }), fallbackDescription).map((v) =>
    videoNode({ ...v, pageUrl: url, uploadDate: null })
  );
}
