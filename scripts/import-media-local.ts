/**
 * import-media-local — offline bridge for the media pipeline.
 *
 * Same image processing as scripts/import-media.ts (EXIF read first, sharp
 * variants, all EXIF stripped from output) but writes the variants into
 * public/media/places/{slug}/ and prints the SQL to insert the media rows,
 * instead of uploading to Supabase Storage.
 *
 * Use this before SUPABASE_SERVICE_ROLE_KEY is available. Once the key is in
 * .env.local, scripts/import-media.ts re-imports the same folder into Storage
 * and those rows supersede these (delete the local rows first).
 *
 *   npx tsx scripts/import-media-local.ts --dir "<folder>" --slug <place-slug>
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import exifr from "exifr";
import {
  IMAGE_VARIANT_WIDTHS,
  LARGEST_VARIANT_WIDTH,
  JPEG_QUALITY,
  WEBP_QUALITY,
} from "../src/lib/media-spec";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function parseArgs(argv: string[]): { dir: string; slug: string } {
  let dir: string | undefined;
  let slug: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dir") dir = argv[++i];
    else if (argv[i] === "--slug") slug = argv[++i];
  }
  if (!dir || !slug) {
    console.error('Usage: npx tsx scripts/import-media-local.ts --dir "<folder>" --slug <slug>');
    process.exit(1);
  }
  return { dir, slug };
}

async function main() {
  const { dir, slug } = parseArgs(process.argv.slice(2));
  const outDir = path.join("public", "media", "places", slug);
  await mkdir(outDir, { recursive: true });

  const files = (await readdir(dir))
    .filter((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase()))
    .sort();
  console.log(`Images found: ${files.length}`);

  type Row = { base: string; w: number; h: number; takenAt: Date | null; gps: [number, number] | null };
  const rows: Row[] = [];

  for (const file of files) {
    const buffer = await readFile(path.join(dir, file));
    // EXIF first — output files carry none (sharp strips metadata by default).
    const exif = (await exifr
      .parse(buffer, { gps: true, pick: ["DateTimeOriginal"] })
      .catch(() => null)) as
      | { latitude?: number; longitude?: number; DateTimeOriginal?: Date }
      | null;

    const base = createHash("sha1").update(buffer).digest("hex").slice(0, 10);
    const pipeline = sharp(buffer).rotate();
    let w = 0;
    let h = 0;

    for (const width of IMAGE_VARIANT_WIDTHS) {
      const { data, info } = await pipeline
        .clone()
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer({ resolveWithObject: true });
      await writeFile(path.join(outDir, `${base}-${width}.webp`), data);
      if (width === LARGEST_VARIANT_WIDTH) {
        w = info.width;
        h = info.height;
      }
    }
    const jpeg = await pipeline
      .clone()
      .resize({ width: LARGEST_VARIANT_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY })
      .toBuffer();
    await writeFile(path.join(outDir, `${base}-${LARGEST_VARIANT_WIDTH}.jpg`), jpeg);

    rows.push({
      base,
      w,
      h,
      takenAt: exif?.DateTimeOriginal instanceof Date ? exif.DateTimeOriginal : null,
      gps:
        typeof exif?.latitude === "number" && typeof exif?.longitude === "number"
          ? [exif.latitude, exif.longitude]
          : null,
    });
    console.log(`Processed ${file} -> ${base} (${w}x${h}) gps=${rows.at(-1)!.gps ? "yes" : "no"}`);
  }

  rows.sort((a, b) => (a.takenAt?.getTime() ?? Infinity) - (b.takenAt?.getTime() ?? Infinity));

  const values = rows
    .map(
      (r, i) =>
        `((select id from p), 'photo', 'storage', '/media/places/${slug}/${r.base}-1600.webp', ` +
        `'/media/places/${slug}/${r.base}-400.webp', ${r.w}, ${r.h}, ${i})`
    )
    .join(",\n  ");

  const sql =
    `with p as (select id from places where slug = '${slug}')\n` +
    `insert into media (place_id, type, provider, url, thumb_url, width, height, sort_order)\nvalues\n  ${values}\n` +
    `on conflict (url) do update set width = excluded.width, height = excluded.height, sort_order = excluded.sort_order;`;

  await writeFile(path.join("scripts", `insert-media-${slug}.sql`), sql, "utf8");
  console.log(`\nWrote ${rows.length} variants sets to ${outDir}`);
  console.log(`SQL written to scripts/insert-media-${slug}.sql`);
  const withGps = rows.filter((r) => r.gps);
  console.log(`Photos with GPS: ${withGps.length}`);
  if (withGps.length) {
    const lats = withGps.map((r) => r.gps![0]).sort((a, b) => a - b);
    const lngs = withGps.map((r) => r.gps![1]).sort((a, b) => a - b);
    const mid = Math.floor(lats.length / 2);
    console.log(`Median GPS: ${lats[mid].toFixed(6)}, ${lngs[mid].toFixed(6)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
