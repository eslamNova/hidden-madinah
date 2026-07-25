/**
 * Single source of truth for the media pipeline, shared by
 * scripts/import-media.ts, the admin uploader, and PlaceImage.
 * Changing widths here without regenerating existing variants will break URLs.
 */
export const IMAGE_VARIANT_WIDTHS = [400, 800, 1600] as const;
export const LARGEST_VARIANT_WIDTH = 1600;
export const THUMB_VARIANT_WIDTH = 400;
export const WEBP_QUALITY = 80;
export const JPEG_QUALITY = 82;
export const MEDIA_BUCKET = "media";

/** Storage object path convention: places/{placeId}/{base}-{width}.{ext} */
export function mediaObjectPath(
  placeId: string,
  base: string,
  width: number,
  ext: "webp" | "jpg"
): string {
  return `places/${placeId}/${base}-${width}.${ext}`;
}

/** Swap the width suffix on a stored variant URL (…-1600.webp → …-400.webp). */
export function variantUrl(url: string, width: number): string {
  return url.replace(/-(400|800|1600)\.(webp|jpg)$/, `-${width}.$2`);
}
