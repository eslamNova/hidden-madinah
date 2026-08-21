import Link from "next/link";
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
  const aspect = compact ? "aspect-[16/10]" : "aspect-[4/5]";

  return (
    <Link
      href={`/places/${encodeURIComponent(place.slug)}`}
      className="card-lift group relative block overflow-hidden rounded-2xl bg-basalt shadow-md"
    >
      {place.thumb ? (
        <PlaceImage
          media={place.thumb}
          alt={place.name_ar}
          sizes="(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 260px"
          className={`${aspect} w-full object-cover`}
          priority={priority}
        />
      ) : (
        <PlaceholderImage category={place.category} className={`${aspect} w-full`} />
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

      {/* Title + two info chips only — the card is a photograph, not a form.
          line-clamp keeps the START of long names visible (they were clipping
          from the top on narrow mobile columns). */}
      <div className="absolute inset-x-0 bottom-0 space-y-2 p-4">
        <h3 className="line-clamp-2 text-xl leading-snug text-paper drop-shadow-sm sm:text-2xl">
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