/**
 * Shared media pipeline — photos (EXIF → WebP/JPEG variants) and videos
 * (ffprobe → 720p H.264 + poster), plus retrying Storage uploads. Used by
 * scripts/import-media.ts (place media) and scripts/build-nabawi.ts (the
 * المسجد النبوي tour chapter).
 */
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import exifr from "exifr";
import {
  IMAGE_VARIANT_WIDTHS,
  LARGEST_VARIANT_WIDTH,
  WEBP_QUALITY,
  JPEG_QUALITY,
} from "../../src/lib/media-spec";

export const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
export const VIDEO_EXTENSIONS = new Set([".mp4"]);
/** storage.buckets file_size_limit for the media bucket (003_storage.sql). */
export const BUCKET_FILE_SIZE_LIMIT = 52_428_800;
/** Videos are re-encoded so their SHORTER side is at most this. */
export const VIDEO_TARGET_SHORT_SIDE = 720;
export const VIDEO_POSTER_WIDTH = 800;

export type ExifInfo = {
  lat: number | null;
  lng: number | null;
  takenAt: Date | null;
};

export type Variant = {
  width: number;
  ext: "webp" | "jpg";
  buffer: Buffer;
};

export type VideoData = {
  /** Re-encoded 720p H.264 mp4, metadata stripped. */
  buffer: Buffer;
  durationSeconds: number;
  poster: { buffer: Buffer; width: number; height: number } | null;
};

export async function uploadWithRetry(
  doUpload: () => Promise<{ error: { message: string } | null }>,
  label: string
): Promise<void> {
  const delaysMs = [0, 2000, 6000];
  let lastMessage = "";
  for (const delay of delaysMs) {
    if (delay > 0) {
      console.warn(`إعادة المحاولة بعد ${delay / 1000} ث / retrying in ${delay / 1000}s: ${label}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    const { error } = await doUpload();
    if (!error) return;
    lastMessage = error.message;
  }
  throw new Error(`upload ${label}: ${lastMessage}`);
}

export async function readExif(buffer: Buffer): Promise<ExifInfo> {
  // GPS is OPTIONAL — Google Photos downloads often strip it.
  // Never fail the import over EXIF problems.
  try {
    const parsed = (await exifr.parse(buffer, {
      gps: true,
      pick: ["DateTimeOriginal"],
    })) as { latitude?: number; longitude?: number; DateTimeOriginal?: Date } | null | undefined;

    const lat = typeof parsed?.latitude === "number" && Number.isFinite(parsed.latitude) ? parsed.latitude : null;
    const lng = typeof parsed?.longitude === "number" && Number.isFinite(parsed.longitude) ? parsed.longitude : null;
    const takenAt = parsed?.DateTimeOriginal instanceof Date && !Number.isNaN(parsed.DateTimeOriginal.getTime())
      ? parsed.DateTimeOriginal
      : null;
    return { lat, lng, takenAt };
  } catch {
    return { lat: null, lng: null, takenAt: null };
  }
}

export async function buildVariants(buffer: Buffer): Promise<{ variants: Variant[]; outWidth: number; outHeight: number }> {
  // .rotate() with no args applies the EXIF orientation, then sharp strips all
  // metadata by default. We intentionally do NOT call .withMetadata() — the
  // published files must carry no EXIF/GPS.
  const pipeline = sharp(buffer).rotate();

  const variants: Variant[] = [];
  let outWidth = 0;
  let outHeight = 0;

  for (const width of IMAGE_VARIANT_WIDTHS) {
    const { data, info } = await pipeline
      .clone()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer({ resolveWithObject: true });
    variants.push({ width, ext: "webp", buffer: data });
    if (width === LARGEST_VARIANT_WIDTH) {
      outWidth = info.width;
      outHeight = info.height;
    }
  }

  // 1600 JPEG fallback (used for OpenGraph images).
  const jpeg = await pipeline
    .clone()
    .resize({ width: LARGEST_VARIANT_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();
  variants.push({ width: LARGEST_VARIANT_WIDTH, ext: "jpg", buffer: jpeg });

  return { variants, outWidth, outHeight };
}

export function ffAvailable(): boolean {
  for (const cmd of ["ffmpeg", "ffprobe"]) {
    const res = spawnSync(cmd, ["-version"], { stdio: "ignore" });
    if (res.error || res.status !== 0) return false;
  }
  return true;
}

export type VideoProbe = {
  width: number;
  height: number;
  durationSeconds: number;
  takenAt: Date | null;
  lat: number | null;
  lng: number | null;
};


function parseIso6709(loc: string | undefined): { lat: number; lng: number } | null {
  if (typeof loc !== "string") return null;
  const m = /^([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)/.exec(loc.trim());
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

export function probeVideo(fullPath: string): VideoProbe {
  const res = spawnSync(
    "ffprobe",
    ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", fullPath],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }
  );
  if (res.error || res.status !== 0) {
    throw new Error(`ffprobe failed: ${res.error?.message ?? res.stderr?.slice(0, 200)}`);
  }
  const parsed = JSON.parse(res.stdout) as {
    streams?: Array<{ codec_type?: string; width?: number; height?: number }>;
    format?: { duration?: string; tags?: Record<string, string> };
  };
  const stream = parsed.streams?.find((s) => s.codec_type === "video");
  if (!stream || typeof stream.width !== "number" || typeof stream.height !== "number") {
    throw new Error("ffprobe: no video stream found");
  }
  const durationSeconds = Number(parsed.format?.duration);
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error("ffprobe: could not read duration");
  }
  const tags = parsed.format?.tags ?? {};
  const creation = tags.creation_time ? new Date(tags.creation_time) : null;
  const gps =
    parseIso6709(tags.location) ??
    parseIso6709(tags["com.apple.quicktime.location.ISO6709"]);
  return {
    width: stream.width,
    height: stream.height,
    durationSeconds,
    takenAt: creation && !Number.isNaN(creation.getTime()) ? creation : null,
    lat: gps?.lat ?? null,
    lng: gps?.lng ?? null,
  };
}

export async function processVideo(fullPath: string, probe: VideoProbe, workDir: string): Promise<VideoData> {
  const outPath = path.join(workDir, `${createHash("sha1").update(fullPath).digest("hex").slice(0, 8)}.mp4`);

  const args = ["-y", "-v", "error", "-i", fullPath];
  // Cap the SHORTER side at 720, never enlarging. Expressed as a filter
  // expression (not from probe dimensions) because ffmpeg applies the
  // rotation flag before filtering — probe width/height are pre-rotation.
  const t = VIDEO_TARGET_SHORT_SIDE;
  args.push(
    "-vf",
    `scale=w='if(gte(iw,ih),-2,min(${t},iw))':h='if(gte(iw,ih),min(${t},ih),-2)'`
  );
  args.push(
    "-map_metadata", "-1",
    "-c:v", "libx264",
    "-crf", "23",
    "-preset", "medium",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    "-c:a", "aac",
    "-b:a", "128k",
    outPath
  );
  const enc = spawnSync("ffmpeg", args, { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  if (enc.error || enc.status !== 0) {
    throw new Error(`ffmpeg encode failed: ${enc.error?.message ?? enc.stderr?.slice(0, 300)}`);
  }
  const buffer = await readFile(outPath);
  if (buffer.length > BUCKET_FILE_SIZE_LIMIT) {
    throw new Error(
      `compressed video is ${(buffer.length / 1024 / 1024).toFixed(1)} MB — over the 50 MB bucket limit; trim the clip and retry`
    );
  }

  // Poster frame from the re-encoded file, same timestamp rule as the admin
  // uploader: min(0.5s, duration/2).
  let poster: VideoData["poster"] = null;
  const posterSrc = path.join(workDir, "poster-frame.jpg");
  const seek = Math.min(0.5, probe.durationSeconds / 2).toFixed(3);
  const grab = spawnSync(
    "ffmpeg",
    ["-y", "-v", "error", "-ss", seek, "-i", outPath, "-frames:v", "1", posterSrc],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }
  );
  if (!grab.error && grab.status === 0) {
    const { data, info } = await sharp(await readFile(posterSrc))
      .resize({ width: VIDEO_POSTER_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer({ resolveWithObject: true });
    poster = { buffer: data, width: info.width, height: info.height };
  }

  return { buffer, durationSeconds: probe.durationSeconds, poster };
}
