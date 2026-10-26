import { siteUrl } from "@/lib/constants";
import { MEDIA_PUBLIC_BASE } from "@/lib/media-spec";

/**
 * Images in blog articles: the cover and the pictures inside the text,
 * uploaded from /admin/articles to Cloudflare R2 (src/app/api/admin/upload)
 * and served from the media domain.
 *
 * Shared by the editor (client), the upload route and the public pages, so
 * no server-only imports here.
 *
 * Object keys carry the pixel size: articles/<yyyy>/<mm>/<random>-<w>x<h>.webp.
 * Pages read it back for <img width height> and og:image:width/height
 * without a database column. Every WebP upload has a JPEG twin under the same
 * name (….jpg): share previews use it, because not every app that unfurls
 * links (WhatsApp on older phones, LinkedIn, some mail clients) shows WebP.
 */

export const ARTICLE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export type ArticleImageType = (typeof ARTICLE_IMAGE_TYPES)[number];
export const ARTICLE_IMAGE_EXT: Record<ArticleImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Per file, after the browser has compressed it. */
export const ARTICLE_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
/**
 * The whole upload request (the WebP and its JPEG twin plus form overhead).
 * Vercel refuses function request bodies above 4.5 MB before our code runs.
 */
export const ARTICLE_UPLOAD_MAX_REQUEST_BYTES = 4.4 * 1024 * 1024;
/** The browser resizes to this width before uploading (the site's largest image variant). */
export const ARTICLE_IMAGE_MAX_WIDTH = 1600;
export const ARTICLE_IMAGE_QUALITY = 0.82;

/** Error codes the upload route returns; messages under admin.articles.upload.errors. */
export type ArticleUploadError =
  | "not_configured"
  | "unauthorized"
  | "forbidden"
  | "too_large"
  | "bad_type"
  | "bad_request"
  | "storage"
  | "decode"
  | "network"
  | "generic";

/**
 * The public media base: MEDIA_PUBLIC_BASE from the environment on the server
 * (an https origin, no trailing slash), else the site's R2 domain. In the
 * browser the variable is not exposed, so this is always the default there.
 */
export function mediaPublicBase(): string {
  const raw = (typeof process !== "undefined" ? process.env.MEDIA_PUBLIC_BASE : undefined)?.trim().replace(/\/+$/, "");
  return raw && /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(raw) ? raw : MEDIA_PUBLIC_BASE;
}

/** articles/2026/10/3f9c0a1b2c3d4e5f-1600x900.webp (UTC year and month). */
export function articleImageKey(date: Date, random: string, width: number, height: number, ext: string): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `articles/${yyyy}/${mm}/${random}-${width}x${height}.${ext}`;
}

const SIZE_IN_NAME = /\/articles\/\d{4}\/\d{2}\/[a-z0-9]+-(\d{1,5})x(\d{1,5})\.(?:webp|jpg|png|gif)$/;

/** The pixel size written in an uploaded article image's name, or null for any other URL. */
export function articleImageSize(url: string): { width: number; height: number } | null {
  let path: string;
  try {
    path = new URL(url).pathname;
  } catch {
    return null;
  }
  const m = SIZE_IN_NAME.exec(path);
  if (!m) return null;
  const width = Number(m[1]);
  const height = Number(m[2]);
  return width > 0 && height > 0 ? { width, height } : null;
}

/** Origins (https) whose images may appear inside an article: the media domain and the site itself. */
export function articleImageOrigins(): string[] {
  const out = new Set<string>([MEDIA_PUBLIC_BASE, mediaPublicBase()]);
  try {
    const site = new URL(siteUrl());
    if (site.protocol === "https:") {
      out.add(site.origin);
      // www and the bare domain serve the same site.
      const twin = site.hostname.startsWith("www.") ? site.hostname.slice(4) : `www.${site.hostname}`;
      out.add(`https://${twin}${site.port ? `:${site.port}` : ""}`);
    }
  } catch {
    // An unparsable NEXT_PUBLIC_SITE_URL only means no site-hosted images.
  }
  return [...out];
}

/**
 * Whether an <img src> may stay in an article: a path on this site
 * ("/images/x.jpg"), or an https URL on one of the allowed origins. Anything
 * else — other hosts, http, data:, protocol-relative "//host" — is dropped.
 */
export function isAllowedArticleImage(src: string, origins: readonly string[] = articleImageOrigins()): boolean {
  const s = src.trim();
  if (!s || /[\u0000-\u001f\u007f\\\s]/.test(s)) return false;
  if (/^\/(?!\/)/.test(s)) return true;
  try {
    const url = new URL(s);
    return url.protocol === "https:" && !url.username && !url.password && origins.includes(url.origin);
  } catch {
    return false;
  }
}

/**
 * The share image for an article image uploaded through the editor: its JPEG
 * twin, with the size from its name. Null for any other URL (the caller
 * falls back to its own rules).
 */
export function uploadedShareImage(url: string): { url: string; width: number; height: number } | null {
  const src = url.trim();
  const fromOurMedia = [MEDIA_PUBLIC_BASE, mediaPublicBase()].some((base) => src.startsWith(`${base}/articles/`));
  if (!fromOurMedia) return null;
  const size = articleImageSize(src);
  if (!size) return null;
  return { url: src.replace(/\.webp$/, ".jpg"), ...size };
}
