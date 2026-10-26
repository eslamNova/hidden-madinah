import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  ARTICLE_IMAGE_EXT,
  ARTICLE_IMAGE_MAX_BYTES,
  ARTICLE_UPLOAD_MAX_REQUEST_BYTES,
  articleImageKey,
  type ArticleUploadError,
} from "@/lib/article-images";
import { sniffImage } from "@/lib/image-sniff";
import { putR2Object, r2Config } from "@/lib/r2";

/**
 * POST /api/admin/upload — one article image (the cover, or a picture inside
 * the text) from the admin editor to Cloudflare R2.
 *
 * Multipart form: `file` (JPEG, PNG, WebP or GIF, at most 4 MB — the browser
 * has already resized and compressed it) and, with a WebP, `fallback`: its
 * JPEG twin of the same size, stored next to it for share previews.
 *
 * Only a signed-in admin (the is_admin() check of every admin action) may
 * upload. The file's bytes decide its type and size, never its declared MIME
 * type or name; the object key is random:
 *   articles/<yyyy>/<mm>/<16 hex>-<width>x<height>.<ext>
 *
 * Answers { ok: true, url, width, height } or { ok: false, error } with an
 * ArticleUploadError code; "not_configured" (503) when the R2 variables are
 * not set, which the editor shows as such.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

const fail = (error: ArticleUploadError, status: number) =>
  NextResponse.json({ ok: false, error }, { status, headers: NO_STORE });

/** Same-origin only (the session cookie is SameSite=Lax already; this is the second lock). */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return !!host && new URL(origin).host === host;
  } catch {
    return false;
  }
}

async function readFile(entry: FormDataEntryValue | null): Promise<Uint8Array<ArrayBuffer> | null> {
  if (!entry || typeof entry === "string") return null;
  if (entry.size > ARTICLE_IMAGE_MAX_BYTES) return null;
  return new Uint8Array(await entry.arrayBuffer());
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return fail("forbidden", 403);
  try {
    await requireAdmin();
  } catch {
    return fail("unauthorized", 401);
  }

  const config = r2Config();
  if (!config) return fail("not_configured", 503);

  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > ARTICLE_UPLOAD_MAX_REQUEST_BYTES) return fail("too_large", 413);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("bad_request", 400);
  }

  const fileEntry = form.get("file");
  if (!fileEntry || typeof fileEntry === "string") return fail("bad_request", 400);
  if (fileEntry.size > ARTICLE_IMAGE_MAX_BYTES) return fail("too_large", 413);
  const bytes = await readFile(fileEntry);
  const image = bytes && sniffImage(bytes);
  if (!bytes || !image) return fail("bad_type", 415);

  // A WebP needs its JPEG twin: share previews link to it (see article-images.ts).
  let twin: Uint8Array<ArrayBuffer> | null = null;
  if (image.type === "image/webp") {
    const fallbackEntry = form.get("fallback");
    if (fallbackEntry && typeof fallbackEntry !== "string" && fallbackEntry.size > ARTICLE_IMAGE_MAX_BYTES) {
      return fail("too_large", 413);
    }
    twin = await readFile(fallbackEntry);
    const twinImage = twin && sniffImage(twin);
    if (!twinImage || twinImage.type !== "image/jpeg" || twinImage.width !== image.width || twinImage.height !== image.height) {
      return fail("bad_request", 400);
    }
  }

  const key = articleImageKey(new Date(), randomBytes(8).toString("hex"), image.width, image.height, ARTICLE_IMAGE_EXT[image.type]);
  try {
    // The twin first: once the WebP exists, its share image does too.
    if (twin) await putR2Object(config, key.replace(/\.webp$/, ".jpg"), twin, "image/jpeg");
    await putR2Object(config, key, bytes, image.type);
  } catch (err) {
    console.error("[upload] R2 write failed:", err instanceof Error ? err.message : err);
    return fail("storage", 502);
  }

  return NextResponse.json(
    { ok: true, url: `${config.publicBase}/${key}`, width: image.width, height: image.height },
    { headers: NO_STORE }
  );
}
