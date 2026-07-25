/* eslint-disable @next/next/no-img-element -- variants are pre-generated at
   fixed widths (400/800/1600); a plain <img> with an explicit srcSet is both
   simpler and faster here than next/image with a custom loader, which cannot
   express "only these three widths exist". */
import { CATEGORY_META, type PlaceCategory } from "@/lib/maps";
import { IMAGE_VARIANT_WIDTHS, variantUrl } from "@/lib/media-spec";
import type { MediaRow } from "@/lib/queries";
import { CategoryIcon } from "@/components/CategoryIcon";

/**
 * Responsive image over the pre-generated variant set. width/height come from
 * the media row (all variants share the aspect ratio) so layout shift is zero;
 * the browser picks the smallest variant that satisfies `sizes`.
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
  const srcSet = IMAGE_VARIANT_WIDTHS.map(
    (w) => `${variantUrl(media.url, w)} ${w}w`
  ).join(", ");

  return (
    <img
      src={variantUrl(media.url, 800)}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      width={media.width ?? 1600}
      height={media.height ?? 1200}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={className}
    />
  );
}

/**
 * Dark, textured stand-in for places awaiting the owner's photography — tuned
 * to sit beside real photos in a gallery grid rather than read as "missing".
 */
export function PlaceholderImage({
  category,
  className,
  iconClassName = "h-14 w-14",
}: {
  category: PlaceCategory;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`placeholder-tile relative flex items-center justify-center overflow-hidden ${className ?? ""}`}
      style={{ ["--tile-color" as string]: CATEGORY_META[category].color }}
    >
      {/* Faint geometric motif — heritage texture, never a focal point. */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.07]"
        viewBox="0 0 120 120"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        stroke="#FAF6EF"
        strokeWidth="0.8"
      >
        <path d="M60 6 74 24 96 24 96 46 110 60 96 74 96 96 74 96 60 114 46 96 24 96 24 74 10 60 24 46 24 24 46 24Z" />
        <circle cx="60" cy="60" r="26" />
        <circle cx="60" cy="60" r="14" />
      </svg>
      <CategoryIcon
        category={category}
        className={`relative ${iconClassName} text-surface/45`}
      />
    </div>
  );
}
