import Link from "next/link";
import { useTranslations } from "next-intl";
import { Star } from "lucide-react";
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

export function PlaceCard({
  place,
  compact = false,
}: {
  place: PlaceCardData;
  compact?: boolean;
}) {
  const t = useTranslations("common");
  const meta = CATEGORY_META[place.category];

  return (
    <Link
      href={`/places/${encodeURIComponent(place.slug)}`}
      className="block overflow-hidden rounded-2xl border border-basalt/10 bg-surface shadow-sm transition-shadow hover:shadow-md focus-visible:shadow-md"
    >
      {place.thumb ? (
        <PlaceImage
          media={{ url: place.thumb.url, width: place.thumb.width, height: place.thumb.height }}
          alt={place.name_ar}
          sizes="(max-width: 640px) 100vw, 400px"
          className={`w-full object-cover ${compact ? "aspect-[16/9]" : "aspect-[4/3]"}`}
        />
      ) : (
        <PlaceholderImage
          category={place.category}
          className={compact ? "aspect-[16/9] w-full" : "aspect-[4/3] w-full"}
        />
      )}
      <div className="space-y-2 p-4">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium text-basalt"
          style={{ backgroundColor: `${meta.color}1f` }}
        >
          <CategoryIcon category={place.category} className="h-4 w-4" />
          {meta.labelAr}
          {place.featured && (
            <Star aria-hidden="true" className="h-4 w-4 text-accent" fill="currentColor" />
          )}
        </span>
        <h3 className="text-xl leading-snug">{place.name_ar}</h3>
        {!compact && place.summary && (
          <p className="line-clamp-2 text-base leading-relaxed text-muted">
            {place.summary}
          </p>
        )}
        {place.distanceKm != null && (
          <p className="text-sm font-medium text-primary">
            {t("distanceKm", { km: place.distanceKm })}
          </p>
        )}
      </div>
    </Link>
  );
}