/**
 * import-media — bulk photo & video importer for دليل المدينة الخفية.
 *
 * Usage (run from the repo root):
 *   npx tsx scripts/import-media.ts --dir "<folder>" --slug <place-slug> [--dry-run]
 *
 * Example:
 *   npx tsx scripts/import-media.ts --dir "C:\Photos\مسجد قباء" --slug masjid-quba
 *
 * For each .jpg/.jpeg/.png/.webp in the folder it:
 *   1. reads EXIF (capture date + GPS) BEFORE any processing,
 *   2. generates 400/800/1600 WebP variants + a 1600 JPEG fallback,
 *   3. uploads them to the Supabase "media" bucket,
 *   4. upserts one media row per photo (idempotent — keyed on the 1600 WebP URL),
 *   5. suggests/sets the place map pin from the median photo GPS,
 *   6. asks the dev server to revalidate the affected pages.
 *
 * For each .mp4 it additionally (requires ffmpeg + ffprobe on PATH):
 *   - probes capture date / GPS / dimensions,
 *   - re-encodes to 720p H.264 (crf 23, faststart, metadata stripped) so the
 *     result fits the bucket's 50 MB / video-mp4-only limits,
 *   - extracts a poster frame (≤800px JPEG) used as thumb_url,
 *   - upserts a type='video' media row (idempotent — keyed on the mp4 URL).
 *   Storage paths match the admin uploader: places/{id}/{base}.mp4 + {base}-poster-800.jpg.
 *
 * Re-running on the same folder produces 0 new rows and simply refreshes files.
 */
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import dotenv from "dotenv";
import sharp from "sharp";
import exifr from "exifr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";
import {
  IMAGE_VARIANT_WIDTHS,
  LARGEST_VARIANT_WIDTH,
  THUMB_VARIANT_WIDTH,
  WEBP_QUALITY,
  JPEG_QUALITY,
  MEDIA_BUCKET,
  mediaObjectPath,
  videoObjectPath,
  videoPosterPath,
} from "../src/lib/media-spec";
import { PROPHETS_MOSQUE, distanceFromHaramKm, haversineKm } from "../src/lib/geo";

dotenv.config({ path: ".env.local", quiet: true });

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

type CliArgs = { dir: string; slug: string; dryRun: boolean };

function printUsage(): void {
  console.error(
    [
      "",
      "الاستخدام / Usage:",
      '  npx tsx scripts/import-media.ts --dir "<folder>" --slug <place-slug> [--dry-run]',
      "",
      "مثال / Example:",
      '  npx tsx scripts/import-media.ts --dir "C:\\Photos\\مسجد قباء" --slug masjid-quba',
      "",
    ].join("\n")
  );
}

function parseArgs(argv: string[]): CliArgs {
  let dir: string | undefined;
  let slug: string | undefined;
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--dir") {
      dir = argv[++i];
    } else if (arg.startsWith("--dir=")) {
      dir = arg.slice("--dir=".length);
    } else if (arg === "--slug") {
      slug = argv[++i];
    } else if (arg.startsWith("--slug=")) {
      slug = arg.slice("--slug=".length);
    } else {
      console.error(`خيار غير معروف / Unknown option: ${arg}`);
      printUsage();
      process.exit(1);
    }
  }

  if (!dir || !slug) {
    console.error("خطأ: الخياران --dir و --slug مطلوبان. / Error: --dir and --slug are required.");
    printUsage();
    process.exit(1);
  }

  return { dir, slug, dryRun };
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

function requireEnv(): { url: string; serviceKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url) {
    console.error(
      [
        "خطأ: NEXT_PUBLIC_SUPABASE_URL غير موجود في ملف .env.local.",
        "Error: NEXT_PUBLIC_SUPABASE_URL is missing/empty in .env.local.",
      ].join("\n")
    );
    process.exit(1);
  }
  if (!serviceKey) {
    console.error(
      [
        "خطأ: SUPABASE_SERVICE_ROLE_KEY غير موجود أو فارغ في ملف .env.local.",
        "انسخه من لوحة تحكم Supabase: Project Settings ← API keys (مفتاح service_role) ثم ألصقه في .env.local.",
        "",
        "Error: SUPABASE_SERVICE_ROLE_KEY is missing/empty in .env.local.",
        "Copy it from the Supabase Dashboard: Project Settings -> API keys (service_role key) and paste it into .env.local.",
      ].join("\n")
    );
    process.exit(1);
  }
  return { url, serviceKey };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const VIDEO_EXTENSIONS = new Set([".mp4"]);
/** storage.buckets file_size_limit for the media bucket (003_storage.sql). */
const BUCKET_FILE_SIZE_LIMIT = 52_428_800;
/** Videos are re-encoded so their SHORTER side is at most this. */
const VIDEO_TARGET_SHORT_SIDE = 720;
const VIDEO_POSTER_WIDTH = 800;

type ExifInfo = {
  lat: number | null;
  lng: number | null;
  takenAt: Date | null;
};

type Variant = {
  width: number;
  ext: "webp" | "jpg";
  buffer: Buffer;
};

type VideoData = {
  /** Re-encoded 720p H.264 mp4, metadata stripped. */
  buffer: Buffer;
  durationSeconds: number;
  poster: { buffer: Buffer; width: number; height: number } | null;
};

type FileRecord = {
  file: string;
  kind: "photo" | "video";
  base: string; // sha1(original).slice(0, 10)
  exif: ExifInfo;
  variants: Variant[];
  video?: VideoData;
  /** Photos: pixel size of the largest (1600) WebP. Videos: poster size. */
  outWidth: number;
  outHeight: number;
  sortOrder: number;
  status: "pending" | "inserted" | "updated" | "dry-run" | "failed";
  error?: string;
};

/**
 * Storage uploads intermittently die with "fetch failed" (Node 20 fetch +
 * larger bodies over flaky links). Retry with backoff before giving up —
 * the outer run is idempotent, but healing here saves whole re-runs.
 */
async function uploadWithRetry(
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

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function readExif(buffer: Buffer): Promise<ExifInfo> {
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

async function buildVariants(buffer: Buffer): Promise<{ variants: Variant[]; outWidth: number; outHeight: number }> {
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

// ---------------------------------------------------------------------------
// Video helpers (ffmpeg / ffprobe)
// ---------------------------------------------------------------------------

function ffAvailable(): boolean {
  for (const cmd of ["ffmpeg", "ffprobe"]) {
    const res = spawnSync(cmd, ["-version"], { stdio: "ignore" });
    if (res.error || res.status !== 0) return false;
  }
  return true;
}

type VideoProbe = {
  width: number;
  height: number;
  durationSeconds: number;
  takenAt: Date | null;
  lat: number | null;
  lng: number | null;
};

/** Parse an ISO 6709 location tag ("+24.4357+039.6155/") into lat/lng. */
function parseIso6709(loc: string | undefined): { lat: number; lng: number } | null {
  if (typeof loc !== "string") return null;
  const m = /^([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)/.exec(loc.trim());
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function probeVideo(fullPath: string): VideoProbe {
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

/**
 * Re-encode to H.264/AAC mp4 (≤720p short side, crf 23, faststart) and strip
 * all container metadata — the published file must carry no GPS, matching the
 * photo pipeline. Also extracts a ≤800px JPEG poster frame.
 */
async function processVideo(fullPath: string, probe: VideoProbe, workDir: string): Promise<VideoData> {
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

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { dir, slug, dryRun } = parseArgs(process.argv.slice(2));
  const { url, serviceKey } = requireEnv();

  const supabase = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false },
  });

  // 1. Resolve the place ----------------------------------------------------
  const { data: place, error: placeError } = await supabase
    .from("places")
    .select("id,lat,lng,slug,name_ar")
    .eq("slug", slug)
    .maybeSingle();

  if (placeError) {
    console.error(`خطأ في الاستعلام عن المكان / Failed to query place: ${placeError.message}`);
    process.exit(1);
  }
  if (!place) {
    const { data: slugRows } = await supabase.from("places").select("slug").order("slug");
    const available = (slugRows ?? []).map((r) => `  - ${r.slug}`).join("\n");
    console.error(
      [
        `خطأ: لا يوجد مكان بالمعرّف "${slug}". / Error: no place found with slug "${slug}".`,
        "المعرّفات المتاحة / Available slugs:",
        available || "  (none)",
      ].join("\n")
    );
    process.exit(1);
  }

  console.log(`المكان / Place: ${place.name_ar} (${place.slug})`);
  if (dryRun) {
    console.log("وضع التجربة: لن يتم رفع أي ملف أو تعديل قاعدة البيانات. / Dry run: no uploads, no DB writes.");
  }

  // 2. Scan the folder ------------------------------------------------------
  try {
    const dirStat = await stat(dir);
    if (!dirStat.isDirectory()) throw new Error("not a directory");
  } catch {
    console.error(`خطأ: المجلد غير موجود / Error: folder not found or not a directory: ${dir}`);
    process.exit(1);
  }

  const entries = await readdir(dir);
  const files = entries
    .filter((name) => {
      const ext = path.extname(name).toLowerCase();
      return IMAGE_EXTENSIONS.has(ext) || VIDEO_EXTENSIONS.has(ext);
    })
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    console.error(
      `خطأ: لا توجد صور (.jpg / .jpeg / .png / .webp) أو فيديوهات (.mp4) في المجلد. / Error: no photos or videos found in: ${dir}`
    );
    process.exit(1);
  }
  const videoCount = files.filter((f) => VIDEO_EXTENSIONS.has(path.extname(f).toLowerCase())).length;
  console.log(`الملفات / Files found: ${files.length} (${files.length - videoCount} صورة / photo(s), ${videoCount} فيديو / video(s))\n`);

  if (videoCount > 0 && !ffAvailable()) {
    console.error(
      [
        "خطأ: يوجد فيديوهات في المجلد لكن ffmpeg/ffprobe غير مثبتين أو غير موجودين في PATH.",
        "Error: the folder contains videos but ffmpeg/ffprobe are not installed or not on PATH.",
      ].join("\n")
    );
    process.exit(1);
  }
  const workDir = videoCount > 0 ? await mkdtemp(path.join(os.tmpdir(), "import-media-")) : null;

  // 3+4. EXIF + variants per file -------------------------------------------
  const records: FileRecord[] = [];
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const isVideo = VIDEO_EXTENSIONS.has(path.extname(file).toLowerCase());
    try {
      if (isVideo) {
        const probe = probeVideo(fullPath);
        const video = await processVideo(fullPath, probe, workDir!);
        const base = createHash("sha1").update(await readFile(fullPath)).digest("hex").slice(0, 10);
        records.push({
          file,
          kind: "video",
          base,
          exif: { lat: probe.lat, lng: probe.lng, takenAt: probe.takenAt },
          variants: [],
          video,
          outWidth: video.poster?.width ?? 0,
          outHeight: video.poster?.height ?? 0,
          sortOrder: 0,
          status: "pending",
        });
        console.log(
          `تمت المعالجة / Processed: ${file} (فيديو ${Math.round(video.durationSeconds)}ث → ${(video.buffer.length / 1024 / 1024).toFixed(1)} MB / video)`
        );
      } else {
        const buffer = await readFile(fullPath);
        const exif = await readExif(buffer); // BEFORE processing — sharp output has no EXIF
        const { variants, outWidth, outHeight } = await buildVariants(buffer);
        const base = createHash("sha1").update(buffer).digest("hex").slice(0, 10);
        records.push({
          file,
          kind: "photo",
          base,
          exif,
          variants,
          outWidth,
          outHeight,
          sortOrder: 0,
          status: "pending",
        });
        console.log(`تمت المعالجة / Processed: ${file} (${outWidth}x${outHeight})`);
      }
    } catch (err) {
      records.push({
        file,
        kind: isVideo ? "video" : "photo",
        base: "",
        exif: { lat: null, lng: null, takenAt: null },
        variants: [],
        outWidth: 0,
        outHeight: 0,
        sortOrder: 0,
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      });
      console.error(`فشلت المعالجة / Failed to process: ${file} — ${err instanceof Error ? err.message : err}`);
    }
  }
  if (workDir) {
    await rm(workDir, { recursive: true, force: true });
  }

  // Sort order: DateTimeOriginal ascending; files without a date go last,
  // ordered by filename.
  const ok = records.filter((r) => r.status !== "failed");
  const dated = ok.filter((r) => r.exif.takenAt !== null);
  const undated = ok.filter((r) => r.exif.takenAt === null);
  dated.sort((a, b) => a.exif.takenAt!.getTime() - b.exif.takenAt!.getTime());
  undated.sort((a, b) => a.file.localeCompare(b.file));
  [...dated, ...undated].forEach((r, i) => {
    r.sortOrder = i;
  });

  // GPS analysis (printed in dry-run too; DB only touched in a real run).
  const gpsRecords = ok.filter((r) => r.exif.lat !== null && r.exif.lng !== null);
  const gpsMedian =
    gpsRecords.length > 0
      ? {
          lat: median(gpsRecords.map((r) => r.exif.lat!)),
          lng: median(gpsRecords.map((r) => r.exif.lng!)),
        }
      : null;

  if (dryRun) {
    for (const r of ok) r.status = "dry-run";
    printGpsReport(place, gpsMedian, gpsRecords.length, true);
    printSummary(records);
    process.exit(records.some((r) => r.status === "failed") ? 1 : 0);
  }

  // Pre-fetch existing media URLs so we can report inserted vs. already-there.
  const { data: existingRows, error: existingError } = await supabase
    .from("media")
    .select("url")
    .eq("place_id", place.id);
  if (existingError) {
    console.error(`خطأ في قراءة الوسائط الحالية / Failed to read existing media: ${existingError.message}`);
    process.exit(1);
  }
  const existingUrls = new Set((existingRows ?? []).map((r) => r.url));

  // 5+6. Upload variants + upsert media rows --------------------------------
  for (const record of ok) {
    try {
      let mainUrl = "";
      let thumbUrl: string | null = null;
      let durationSeconds: number | null = null;

      if (record.kind === "video" && record.video) {
        const objectPath = videoObjectPath(place.id, record.base);
        await uploadWithRetry(
          () =>
            supabase.storage.from(MEDIA_BUCKET).upload(objectPath, record.video!.buffer, {
              contentType: "video/mp4",
              upsert: true,
              cacheControl: "31536000",
            }),
          objectPath
        );
        mainUrl = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(objectPath).data.publicUrl;
        durationSeconds = Math.round(record.video.durationSeconds);

        if (record.video.poster) {
          const posterPath = videoPosterPath(place.id, record.base);
          await uploadWithRetry(
            () =>
              supabase.storage.from(MEDIA_BUCKET).upload(posterPath, record.video!.poster!.buffer, {
                contentType: "image/jpeg",
                upsert: true,
                cacheControl: "31536000",
              }),
            posterPath
          );
          thumbUrl = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(posterPath).data.publicUrl;
        }
      } else {
        for (const variant of record.variants) {
          const objectPath = mediaObjectPath(place.id, record.base, variant.width, variant.ext);
          const contentType = variant.ext === "webp" ? "image/webp" : "image/jpeg";
          await uploadWithRetry(
            () =>
              supabase.storage.from(MEDIA_BUCKET).upload(objectPath, variant.buffer, {
                contentType,
                upsert: true,
                cacheControl: "31536000",
              }),
            objectPath
          );
          const { data: pub } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(objectPath);
          if (variant.ext === "webp" && variant.width === LARGEST_VARIANT_WIDTH) {
            mainUrl = pub.publicUrl;
          }
          if (variant.ext === "webp" && variant.width === THUMB_VARIANT_WIDTH) {
            thumbUrl = pub.publicUrl;
          }
        }
      }

      const isNew = !existingUrls.has(mainUrl);
      const { error: upsertError } = await supabase
        .from("media")
        .upsert(
          {
            place_id: place.id,
            type: record.kind,
            provider: "storage",
            url: mainUrl,
            thumb_url: thumbUrl,
            width: record.outWidth,
            height: record.outHeight,
            duration_seconds: durationSeconds,
            sort_order: record.sortOrder,
          },
          { onConflict: "url" }
        );
      if (upsertError) {
        throw new Error(`media upsert: ${upsertError.message}`);
      }

      record.status = isNew ? "inserted" : "updated";
      console.log(
        `${isNew ? "أُضيف صف جديد / Row inserted" : "الصف موجود، تم تحديثه / Row already existed, refreshed"}: ${record.file}`
      );
    } catch (err) {
      record.status = "failed";
      record.error = err instanceof Error ? err.message : String(err);
      console.error(`فشل الرفع / Upload failed: ${record.file} — ${record.error}`);
    }
  }

  // 7. GPS: set or compare the map pin --------------------------------------
  printGpsReport(place, gpsMedian, gpsRecords.length, false);
  if (gpsMedian) {
    if (place.lat === null && place.lng === null) {
      const distanceKm = distanceFromHaramKm(gpsMedian);
      const { error: updateError } = await supabase
        .from("places")
        .update({
          lat: gpsMedian.lat,
          lng: gpsMedian.lng,
          distance_from_prophets_mosque_km: distanceKm,
        })
        .eq("id", place.id);
      if (updateError) {
        console.error(`خطأ في تحديث إحداثيات المكان / Failed to update place coordinates: ${updateError.message}`);
        process.exitCode = 1;
      } else {
        console.log(
          [
            "تم ضبط إحداثيات المكان من الصور / Place pin set from photo GPS:",
            `  lat=${gpsMedian.lat.toFixed(6)}, lng=${gpsMedian.lng.toFixed(6)}`,
            `  المسافة عن المسجد النبوي / Distance from the Prophet's Mosque: ${distanceKm} km`,
          ].join("\n")
        );
      }
    }
  }

  // 9. Ask the app to revalidate the affected pages -------------------------
  const revalidateSecret = process.env.REVALIDATE_SECRET?.trim();
  const anySuccess = ok.some((r) => r.status === "inserted" || r.status === "updated");
  if (revalidateSecret && anySuccess) {
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000").replace(/\/$/, "");
    const paths = ["/", "/places", `/places/${slug}`, "/map"];
    try {
      const res = await fetch(`${siteUrl}/api/revalidate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: revalidateSecret, paths }),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        console.log(`تم تحديث الصفحات / Revalidated: ${paths.join(", ")}`);
      } else {
        console.warn(`تحذير: فشل التحديث / Warning: revalidate responded ${res.status} — refresh manually.`);
      }
    } catch {
      // The dev server may simply be down — a warning, not a failure.
      console.warn(
        `تحذير: تعذر الوصول إلى ${siteUrl} لتحديث الصفحات (ربما الخادم متوقف). / Warning: could not reach ${siteUrl} to revalidate (server may be down).`
      );
    }
  }

  // 10. Summary --------------------------------------------------------------
  printSummary(records);

  if (records.some((r) => r.status === "failed")) {
    process.exit(1);
  }
}

function printGpsReport(
  place: { lat: number | null; lng: number | null },
  gpsMedian: { lat: number; lng: number } | null,
  gpsCount: number,
  dryRun: boolean
): void {
  console.log("");
  if (!gpsMedian) {
    console.log(
      "لا توجد بيانات GPS في الصور (تنزيلات Google Photos غالباً تحذفها). / No GPS data in the photos (Google Photos downloads often strip it)."
    );
    return;
  }
  console.log(
    `بيانات GPS من ${gpsCount} صورة — الوسيط / GPS from ${gpsCount} photo(s) — median: lat=${gpsMedian.lat.toFixed(6)}, lng=${gpsMedian.lng.toFixed(6)}`
  );
  if (place.lat !== null || place.lng !== null) {
    if (place.lat !== null && place.lng !== null) {
      const diffKm = haversineKm({ lat: place.lat, lng: place.lng }, gpsMedian);
      console.log(
        [
          "المكان لديه إحداثيات بالفعل — لن تُستبدل. / Place already has coordinates — NOT overwriting.",
          `  المكان / place:        lat=${place.lat.toFixed(6)}, lng=${place.lng.toFixed(6)}`,
          `  وسيط الصور / photos:   lat=${gpsMedian.lat.toFixed(6)}, lng=${gpsMedian.lng.toFixed(6)}`,
          `  الفرق بينهما / offset: ${diffKm.toFixed(2)} km`,
        ].join("\n")
      );
    } else {
      console.log("المكان لديه إحداثية واحدة فقط (بيانات ناقصة) — لن تُعدَّل تلقائياً. / Place has only one coordinate set — not auto-updating.");
    }
  } else if (dryRun) {
    const distanceKm = distanceFromHaramKm(gpsMedian);
    console.log(
      `في التشغيل الفعلي سيتم ضبط إحداثيات المكان على الوسيط أعلاه (المسافة عن الحرم ${distanceKm} كم). / A real run would set the place pin to the median above (distance from the Haram: ${distanceKm} km).`
    );
  }
}

function printSummary(records: FileRecord[]): void {
  console.log("\nالملخص / Summary:");
  console.table(
    records.map((r) => ({
      file: r.file,
      kind: r.kind,
      size: r.outWidth > 0 ? `${r.outWidth}x${r.outHeight}` : "-",
      gps: r.exif.lat !== null && r.exif.lng !== null ? "yes" : "no",
      taken: r.exif.takenAt ? r.exif.takenAt.toISOString().slice(0, 10) : "-",
      variants:
        r.kind === "video"
          ? r.video
            ? `mp4 ${(r.video.buffer.length / 1024 / 1024).toFixed(1)}MB${r.video.poster ? " + poster" : ""}`
            : "-"
          : r.variants.length > 0
            ? r.variants.map((v) => `${v.width}.${v.ext}`).join(" ")
            : "-",
      row: r.status + (r.error ? ` (${r.error})` : ""),
    }))
  );
  const failed = records.filter((r) => r.status === "failed").length;
  const inserted = records.filter((r) => r.status === "inserted").length;
  const updated = records.filter((r) => r.status === "updated").length;
  console.log(
    `جديد / inserted: ${inserted} — محدَّث / refreshed: ${updated} — فشل / failed: ${failed}`
  );
  // Reference point, useful when eyeballing GPS numbers above.
  console.log(
    `(المسجد النبوي / Prophet's Mosque reference: lat=${PROPHETS_MOSQUE.lat}, lng=${PROPHETS_MOSQUE.lng})`
  );
}

main().catch((err) => {
  console.error("خطأ غير متوقع / Unexpected error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
