import Link from "next/link";
import { useTranslations } from "next-intl";
import { MapPin, Star } from "lucide-react";
import { stripVerify } from "@/lib/content";
import { CATEGORY_META, type PlaceCategory } from "@/lib/maps";
import type { PlaceWithMedia } from "@/lib/queries";
import { CategoryIcon } from "@/components/CategoryIcon";
import { PlaceImage, PlaceholderImage } from "@/components/place/PlaceImage";

/** Lean, serializable card data — safe to pass into client components. */
export type PlaceCardData = {
  slug: string;
  name_ar: string;
  category: PlaceCategory;
  summary: string | null;
  distanceKm: number | null;
  thumb: { url: string; width: number; height: number } | null;
  featured: boolean;
};

/** Server-side converter: strips [VERIFY] markers and drops non-public fields. */
export function toPlaceCardData(p: PlaceWithMedia): PlaceCardData {
  const photo = p.media.find((m) => m.type === "photo");
  return {
    slug: p.slug,
    name_ar: p.name_ar,
    category: p.category,
    summary: stripVerify(p.summary_ar),
    distanceKm:
      p.distance_from_prophets_mosque_km != null
        ? Number(p.distance_from_prophets_mosque_km)
        : null,
    thumb:
      photo?.thumb_url && photo.width && photo.height
        ? { url: photo.thumb_url, width: photo.width, height: photo.height }
        : null,
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
  const meta = CATEGORY_META[place.category];
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
          sizes="(max-width: 640px) 92vw, (max-width: 1024px) 45vw, 360px"
          className={`${aspect} w-full object-cover`}
          priority={priority}
        />
      ) : (
        <PlaceholderImage category={place.category} className={`${aspect} w-full`} />
      )}

      {/* Scrim carries the text — legible over any photograph. */}
      <div aria-hidden="true" className="scrim absolute inset-0" />

      {place.featured && (
        <span className="absolute end-3 top-3 flex items-center gap-1 rounded-full bg-basalt/70 px-3 py-1 text-sm font-medium text-accent backdrop-blur-sm">
          <Star aria-hidden="true" className="h-4 w-4" fill="currentColor" />
          {t("featured")}
        </span>
      )}

      <div className="absolute inset-x-0 bottom-0 space-y-1.5 p-4">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-surface/85">
          <CategoryIcon category={place.category} className="h-4 w-4" />
          <span style={{ color: meta.tintOnDark }}>{meta.labelAr}</span>
        </span>
        <h3 className="text-2xl leading-snug text-surface drop-shadow-sm">
          {place.name_ar}
        </h3>
        {!compact && place.summary && (
          <p className="line-clamp-2 text-base leading-relaxed text-surface/80">
            {place.summary}
          </p>
        )}
        {place.distanceKm != null && (
          <p className="flex items-center gap-1.5 pt-0.5 text-sm font-medium text-surface/90">
            <MapPin aria-hidden="true" className="h-4 w-4" />
            {t("distanceKm", { km: place.distanceKm })}
          </p>
        )}
      </div>
    </Link>
  );
}