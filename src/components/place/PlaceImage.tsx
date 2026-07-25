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