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
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";
import {
  LARGEST_VARIANT_WIDTH,
  THUMB_VARIANT_WIDTH,
  MEDIA_BUCKET,
  mediaObjectPath,
  videoObjectPath,
  videoPosterPath,
} from "../src/lib/media-spec";
import {
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
  buildVariants,
  ffAvailable,
  probeVideo,
  processVideo,
  readExif,
  uploadWithRetry,
  type ExifInfo,
  type Variant,
  type VideoData,
} from "./lib/media-pipeline";
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
// Helpers (shared pipeline lives in ./lib/media-pipeline.ts)
// ---------------------------------------------------------------------------

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

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
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
