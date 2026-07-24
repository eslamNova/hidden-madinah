import Image from "next/image";
import { CATEGORY_META, type PlaceCategory } from "@/lib/maps";
import type { MediaRow } from "@/lib/queries";
import { CategoryIcon } from "@/components/CategoryIcon";

/**
 * next/image wrapper for a media row: explicit width/height from the row keep
 * layout shift at zero; the custom loader snaps to pre-generated variants.
 */
export function PlaceImage({
  media,
  alt,
  sizes,
  className,
  priority = false,
}: {
  media: Pick<MediaRow, "url" | "width" | "height">;
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={media.url}
      alt={alt}
      width={media.width ?? 1600}
      height={media.height ?? 1200}
      sizes={sizes}
      className={className}
      priority={priority}
    />
  );
}

/** Soft category-colored block used wherever a place has no media yet. */
export function PlaceholderImage({
  category,
  className,
}: {
  category: PlaceCategory;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`flex items-center justify-center ${className ?? ""}`}
      style={{ backgroundColor: `${CATEGORY_META[category].color}1f` }}
    >
      <CategoryIcon category={category} className="h-12 w-12" />
    </div>
  );
}