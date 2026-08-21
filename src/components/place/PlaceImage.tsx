/* eslint-disable @next/next/no-img-element -- variants are pre-generated at
   fixed widths (400/800/1600); a plain <img> with an explicit srcSet is both
   simpler and faster here than next/image with a custom loader, which cannot
   express "only these three widths exist". */
"use client";

import { useState } from "react";
import { CATEGORY_META, type PlaceCategory } from "@/lib/maps";
import { IMAGE_VARIANT_WIDTHS, variantUrl } from "@/lib/media-spec";
import type { MediaRow } from "@/lib/queries";
import { CategoryIcon } from "@/components/CategoryIcon";

/**
 * Responsive image over the pre-generated variant set. width/height come from
 * the media row (all variants share the aspect ratio) so layout shift is zero;
 * the browser picks the smallest variant that satisfies `sizes`.
 *
 * Non-priority images fade in on load (500ms) instead of popping — priority
 * (LCP) images skip the fade so first paint stays instant. The ref `complete`
 * check keeps cached images instant on back-navigation, and onError reveals
 * the basalt tile rather than leaving a permanently invisible slot.
 *
 * `capMobile` (full-bleed callers): below 768px the candidate list stops at
 * 800w — a DPR-3 phone would otherwise multiply 100vw into the 1600w file
 * (~346kB vs ~95kB) for pixels that are invisible under the scrim overlays.
 *
 * `singleVariant` sources that have no variant set (video poster frames, which
 * are written at 800px only) render as a bare src — variantUrl would otherwise
 * rewrite the width suffix to files that were never generated.
 */
export function PlaceImage({
  media,
  alt,
  sizes,
  className,
  priority = false,
  capMobile = false,
}: {
  media: Pick<MediaRow, "url" | "width" | "height"> & { singleVariant?: boolean };
  alt: string;
  sizes: string;
  className?: string;
  priority?: boolean;
  capMobile?: boolean;
}) {
  const [loaded, setLoaded] = useState(priority);
  const markLoaded = () => setLoaded(true);

  const img = (
    <img
      src={media.singleVariant ? media.url : variantUrl(media.url, 800)}
      srcSet={
        media.singleVariant
          ? undefined
          : (capMobile ? IMAGE_VARIANT_WIDTHS.filter((w) => w <= 800) : IMAGE_VARIANT_WIDTHS)
              .map((w) => `${variantUrl(media.url, w)} ${w}w`)
              .join(", ")
      }
      sizes={media.singleVariant ? undefined : sizes}
      alt={alt}
      width={media.width ?? 1600}
      height={media.height ?? 1200}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      onLoad={markLoaded}
      onError={markLoaded}
      ref={(el) => {
        if (el?.complete) setLoaded(true);
      }}
      className={`${className ?? ""} transition-opacity duration-500 ease-out ${
        loaded ? "opacity-100" : "opacity-0"
      }`}
    />
  );

  if (media.singleVariant || !capMobile) return img;

  // Desktop keeps the full candidate list (including 1600w); the capped <img>
  // above serves phones. <picture> adds no box, so absolute positioning on the
  // inner img is unaffected.
  return (
    <picture>
      <source
        media="(min-width: 768px)"
        srcSet={IMAGE_VARIANT_WIDTHS.map((w) => `${variantUrl(media.url, w)} ${w}w`).join(", ")}
        sizes={sizes}
      />
      {img}
    </picture>
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
