const VARIANT_WIDTHS = [400, 800, 1600];

/**
 * Custom next/image loader for pre-generated Supabase Storage variants.
 * Media rows store the 1600px WebP URL; this snaps a requested width to the
 * nearest pre-generated variant ({base}-400/800/1600.webp). Non-storage URLs
 * (local assets, embeds) pass through untouched.
 */
export default function supabaseVariantLoader({
  src,
  width,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  const isVariantSource =
    src.includes("/storage/v1/object/public/media/") || src.startsWith("/media/");
  if (!isVariantSource) return src;
  if (!/-(400|800|1600)\.webp$/.test(src)) return src;
  const snapped = VARIANT_WIDTHS.find((w) => w >= width) ?? 1600;
  return src.replace(/-(400|800|1600)\.webp$/, `-${snapped}.webp`);
}
