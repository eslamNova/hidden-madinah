/**
 * import-media — bulk photo importer for دليل المدينة الخفية.
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
 * Re-running on the same folder produces 0 new rows and simply refreshes files.
 */
import { readdir, readFile, stat } from "node:fs/promises";
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

type FileRecord = {
  file: string;
  base: string; // sha1(original).slice(0, 10)
  exif: ExifInfo;
  variants: Variant[];
  /** Actual pixel size of the largest (1600) WebP output. */
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
    .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    console.error(
      `خطأ: لا توجد صور (.jpg / .jpeg / .png / .webp) في المجلد. / Error: no images found in: ${dir}`
    );
    process.exit(1);
  }
  console.log(`عدد الصور / Images found: ${files.length}\n`);

  // 3+4. EXIF + variants per file -------------------------------------------
  const records: FileRecord[] = [];
  for (const file of files) {
    const fullPath = path.join(dir, file);
    try {
      const buffer = await readFile(fullPath);
      const exif = await readExif(buffer); // BEFORE processing — sharp output has no EXIF
      const { variants, outWidth, outHeight } = await buildVariants(buffer);
      const base = createHash("sha1").update(buffer).digest("hex").slice(0, 10);
      records.push({
        file,
        base,
        exif,
        variants,
        outWidth,
        outHeight,
        sortOrder: 0,
        status: "pending",
      });
      console.log(`تمت المعالجة / Processed: ${file} (${outWidth}x${outHeight})`);
    } catch (err) {
      records.push({
        file,
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
      let publicUrl1600 = "";
      let thumbUrl400 = "";

      for (const variant of record.variants) {
        const objectPath = mediaObjectPath(place.id, record.base, variant.width, variant.ext);
        const contentType = variant.ext === "webp" ? "image/webp" : "image/jpeg";
        const { error: uploadError } = await supabase.storage
          .from(MEDIA_BUCKET)
          .upload(objectPath, variant.buffer, {
            contentType,
            upsert: true,
            cacheControl: "31536000",
          });
        if (uploadError) {
          throw new Error(`upload ${objectPath}: ${uploadError.message}`);
        }
        const { data: pub } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(objectPath);
        if (variant.ext === "webp" && variant.width === LARGEST_VARIANT_WIDTH) {
          publicUrl1600 = pub.publicUrl;
        }
        if (variant.ext === "webp" && variant.width === THUMB_VARIANT_WIDTH) {
          thumbUrl400 = pub.publicUrl;
        }
      }

      const isNew = !existingUrls.has(publicUrl1600);
      const { error: upsertError } = await supabase
        .from("media")
        .upsert(
          {
            place_id: place.id,
            type: "photo",
            provider: "storage",
            url: publicUrl1600,
            thumb_url: thumbUrl400,
            width: record.outWidth,
            height: record.outHeight,
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
      size: r.outWidth > 0 ? `${r.outWidth}x${r.outHeight}` : "-",
      gps: r.exif.lat !== null && r.exif.lng !== null ? "yes" : "no",
      taken: r.exif.takenAt ? r.exif.takenAt.toISOString().slice(0, 10) : "-",
      variants:
        r.variants.length > 0
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
