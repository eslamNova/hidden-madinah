import { useCallback, useState } from "react";
import {
  ARTICLE_IMAGE_MAX_BYTES,
  ARTICLE_IMAGE_MAX_WIDTH,
  ARTICLE_IMAGE_QUALITY,
  ARTICLE_UPLOAD_MAX_REQUEST_BYTES,
  type ArticleUploadError,
} from "@/lib/article-images";

/**
 * Article image uploads from the admin editor, browser side: resize to at
 * most 1600 px wide and compress (WebP at quality 0.82, plus the JPEG twin the
 * server keeps for share previews), then POST to /api/admin/upload with
 * progress. Re-encoding on a canvas also drops EXIF metadata, GPS included.
 *
 * Browsers that cannot encode WebP (Safari) send a JPEG alone. A GIF small
 * enough goes up untouched so an animation survives.
 */

export type UploadedImage = { url: string; width: number; height: number };

export type UploadStatus =
  | { state: "preparing" }
  | { state: "uploading"; percent: number }
  | { state: "done" }
  | { state: "error"; code: ArticleUploadError };

export class UploadFailure extends Error {
  constructor(readonly code: ArticleUploadError) {
    super(code);
  }
}

const KNOWN_ERRORS: readonly ArticleUploadError[] = [
  "not_configured", "unauthorized", "forbidden", "too_large", "bad_type", "bad_request", "storage", "decode", "network", "generic",
];
const asError = (v: unknown): ArticleUploadError | null =>
  typeof v === "string" && (KNOWN_ERRORS as readonly string[]).includes(v) ? (v as ArticleUploadError) : null;

type Drawable = { source: CanvasImageSource; width: number; height: number; release: () => void };

/** Decodes the file, upright (EXIF orientation applied). */
async function decode(file: File): Promise<Drawable> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  } catch {
    // Older Safari refuses the options (or the format): an <img> decodes what the browser can show.
  }
  const url = URL.createObjectURL(file);
  try {
    const img = document.createElement("img");
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) throw new Error("empty image");
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new UploadFailure("decode");
  }
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

type Prepared = { file: Blob; name: string; fallback?: Blob };

/** Form-data overhead allowance under the request cap. */
const OVERHEAD = 64 * 1024;

async function prepare(file: File): Promise<Prepared> {
  if (file.type && !file.type.startsWith("image/")) throw new UploadFailure("bad_type");
  if (file.type === "image/gif" && file.size <= ARTICLE_IMAGE_MAX_BYTES) return { file, name: "image.gif" };

  const image = await decode(file);
  try {
    const scale = Math.min(1, ARTICLE_IMAGE_MAX_WIDTH / image.width);
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new UploadFailure("decode");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image.source, 0, 0, width, height);

    // JPEG has no transparency: the twin gets a white page behind the picture.
    const flat = document.createElement("canvas");
    flat.width = width;
    flat.height = height;
    const flatCtx = flat.getContext("2d");
    if (!flatCtx) throw new UploadFailure("decode");
    flatCtx.fillStyle = "#ffffff";
    flatCtx.fillRect(0, 0, width, height);
    flatCtx.drawImage(canvas, 0, 0);

    for (const quality of [ARTICLE_IMAGE_QUALITY, 0.72, 0.6]) {
      const [webp, jpeg] = await Promise.all([toBlob(canvas, "image/webp", quality), toBlob(flat, "image/jpeg", quality)]);
      if (!jpeg) throw new UploadFailure("decode");
      // Safari answers a WebP request with a PNG: send the JPEG alone.
      if (webp && webp.type === "image/webp") {
        const fits =
          webp.size <= ARTICLE_IMAGE_MAX_BYTES &&
          jpeg.size <= ARTICLE_IMAGE_MAX_BYTES &&
          webp.size + jpeg.size <= ARTICLE_UPLOAD_MAX_REQUEST_BYTES - OVERHEAD;
        if (fits) return { file: webp, name: "image.webp", fallback: jpeg };
      } else if (jpeg.size <= ARTICLE_IMAGE_MAX_BYTES) {
        return { file: jpeg, name: "image.jpg" };
      }
    }
    throw new UploadFailure("too_large");
  } finally {
    image.release();
  }
}

function send(prepared: Prepared, onProgress: (percent: number) => void): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", prepared.file, prepared.name);
    if (prepared.fallback) form.append("fallback", prepared.fallback, "image.jpg");

    // XMLHttpRequest, not fetch: it reports upload progress.
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/upload");
    xhr.responseType = "json";
    xhr.timeout = 90_000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)));
    };
    xhr.onload = () => {
      const body = (xhr.response ?? null) as { ok?: boolean; url?: unknown; width?: unknown; height?: unknown; error?: unknown } | null;
      if (xhr.status >= 200 && xhr.status < 300 && body?.ok && typeof body.url === "string") {
        resolve({ url: body.url, width: Number(body.width) || 0, height: Number(body.height) || 0 });
        return;
      }
      const code =
        asError(body?.error) ?? (xhr.status === 401 ? "unauthorized" : xhr.status === 413 ? "too_large" : "generic");
      reject(new UploadFailure(code));
    };
    xhr.onerror = () => reject(new UploadFailure("network"));
    xhr.ontimeout = () => reject(new UploadFailure("network"));
    xhr.send(form);
  });
}

/** Resizes, compresses and uploads one image, reporting each step. */
export async function uploadArticleImage(file: File, onStatus: (s: UploadStatus) => void): Promise<UploadedImage> {
  onStatus({ state: "preparing" });
  const prepared = await prepare(file);
  onStatus({ state: "uploading", percent: 0 });
  const uploaded = await send(prepared, (percent) => onStatus({ state: "uploading", percent }));
  onStatus({ state: "done" });
  return uploaded;
}

/**
 * One upload at a time with its status for the UI. `upload` resolves to the
 * uploaded image, or null after a failure (the status then holds the error).
 */
export function useImageUpload(enabled: boolean) {
  const [status, setStatus] = useState<UploadStatus | null>(null);
  const busy = status?.state === "preparing" || status?.state === "uploading";

  const upload = useCallback(
    async (file: File): Promise<UploadedImage | null> => {
      if (!enabled) {
        setStatus({ state: "error", code: "not_configured" });
        return null;
      }
      try {
        return await uploadArticleImage(file, setStatus);
      } catch (err) {
        setStatus({ state: "error", code: err instanceof UploadFailure ? err.code : "generic" });
        return null;
      }
    },
    [enabled]
  );

  const report = useCallback((code: ArticleUploadError) => setStatus({ state: "error", code }), []);
  const clear = useCallback(() => setStatus(null), []);
  return { status, busy, upload, report, clear };
}

/** Image files in a paste or drop, when that is all it carries (a Word paste also has a picture of its text). */
export function droppedImages(data: DataTransfer | null): File[] {
  if (!data) return [];
  const files = [...data.files].filter((f) => f.type.startsWith("image/"));
  if (!files.length) return [];
  return data.getData("text/plain").trim() ? [] : files;
}
