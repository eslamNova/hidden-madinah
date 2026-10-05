import Link from "@/components/i18n/Link";
import { useTranslations } from "next-intl";
import { Clock, MapPin, Star } from "lucide-react";
import { coverImage, stripVerify, type CoverImage } from "@/lib/content";
import type { PlaceCategory } from "@/lib/maps";
import type { PlaceWithMedia } from "@/lib/queries";
import { PlaceImage, PlaceholderImage } from "@/components/place/PlaceImage";

/** Lean, serializable card data — safe to pass into client components. */
export type PlaceCardData = {
  slug: string;
  name_ar: string;
  category: PlaceCategory;
  summary: string | null;
  distanceKm: number | null;
  driveTimeMin: number | null;
  thumb: CoverImage | null;
  featured: boolean;
};

/** Server-side converter: strips [VERIFY] markers and drops non-public fields. */
export function toPlaceCardData(p: PlaceWithMedia): PlaceCardData {
  return {
    slug: p.slug,
    name_ar: p.name_ar,
    category: p.category,
    summary: stripVerify(p.summary_ar),
    distanceKm:
      p.distance_from_prophets_mosque_km != null
        ? Number(p.distance_from_prophets_mosque_km)
        : null,
    driveTimeMin: p.drive_time_from_haram_min,
    thumb: coverImage(p.media),
    featured: p.featured,
  };
}

/**
 * Gallery tile: the photograph is the card. Category, name and distance sit on
 * a dark scrim over the image so the grid reads as photography, not as forms.
 *
 * The photo is absolutely positioned and fills whatever height the card ends up
 * at; the caption sits in normal flow BELOW a photo-band spacer, with no
 * line-clamp. Long names (مسجد العُصْبة (مسجد النور) وبئر الهجين) therefore
 * lengthen the card instead of being cut off — at any أ+ font step. Grid
 * siblings stretch to the tallest card in the row, so the rows stay level.
 */
export function PlaceCard({
  place,
  compact = false,
  priority = false,
}: {
  place: PlaceCardData;
  compact?: boolean;
  priority?: boolean;
}) {
  const t = useTranslations("common");
  // Clean band of photograph above the caption — the card's minimum height.
  const photoBand = compact ? "aspect-[16/9]" : "aspect-[5/4]";

  return (
    <Link
      href={`/places/${encodeURIComponent(place.slug)}`}
      className="card-lift group relative flex h-full flex-col justify-end overflow-hidden rounded-2xl bg-basalt shadow-md"
    >
      {place.thumb ? (
        <PlaceImage
          media={place.thumb}
          alt={place.name_ar}
          sizes="(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 260px"
          className="absolute inset-0 h-full w-full object-cover"
          priority={priority}
        />
      ) : (
        // Wrapper supplies the absolute positioning: PlaceholderImage's own
        // `relative` class would win the conflict (same as StoryPanel).
        <div aria-hidden="true" className="absolute inset-0">
          <PlaceholderImage category={place.category} className="h-full w-full" />
        </div>
      )}

      {/* Soft dark veil over the whole photo + the bottom scrim: light text
          must survive even a bright sky/sand photograph. */}
      <div aria-hidden="true" className="absolute inset-0 bg-basalt/25" />
      <div aria-hidden="true" className="scrim absolute inset-0" />

      {/* Near-opaque pill, light label: gold on 70% glass fell below AA over
          bright photos (gold stays on the decorative star only). */}
      {place.featured && (
        <span className="absolute end-3 top-3 flex items-center gap-1 rounded-full bg-basalt/85 px-3 py-1 text-sm font-medium text-paper">
          <Star
            aria-hidden="true"
            className="h-4 w-4 text-accent"
            fill="currentColor"
          />
          {t("featured")}
        </span>
      )}

      {/* Photo-led minimum height: the band of photograph above the caption. */}
      <div aria-hidden="true" className={`w-full shrink-0 ${photoBand}`} />

      {/* Title + two info chips only — the card is a photograph, not a form.
          In flow (not absolute) and unclamped, so the name is always complete;
          `relative` lifts it above the two absolute scrim layers. */}
      <div className="relative space-y-2 p-4">
        {/* text-lg on the narrow 2-up mobile grid: at the أ+ max step text-xl
            forces mid-word breaks in long names (المستظـل). break-words stays
            as the last-resort guard against overflow. */}
        <h3 className="break-words text-lg leading-snug text-paper drop-shadow-sm sm:text-xl lg:text-2xl">
          {place.name_ar}
        </h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium text-paper/90">
          {place.distanceKm != null && (
            <span className="inline-flex items-center gap-1">
              <MapPin aria-hidden="true" className="h-4 w-4 shrink-0" />
              {t("kmCompact", { km: place.distanceKm })}
            </span>
          )}
          {place.driveTimeMin != null && (
            <span className="inline-flex items-center gap-1">
              <Clock aria-hidden="true" className="h-4 w-4 shrink-0" />
              {t("minCompact", { min: place.driveTimeMin })}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}