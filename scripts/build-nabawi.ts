/**
 * build-nabawi — the المسجد النبوي chapter of the photo tour.
 *
 * Usage:
 *   NODE_OPTIONS=--experimental-websocket npx tsx scripts/build-nabawi.ts --dir "<folder>" [--dry-run]
 *
 * The Prophet's Mosque is deliberately NOT a place row (it must never appear
 * in /places, /map or counts), so its media bypasses the `media` table: files
 * are processed with the shared pipeline, uploaded to Storage under
 * `nabawi/`, and listed in the generated manifest src/lib/nabawi-media.ts,
 * which /tour prepends as an opening chapter.
 *
 * Photos: every .jpg/.png in the folder. Videos: clips ≤ 20 s with a short
 * side ≥ 720 px (slideshow-friendly; drops long walkthroughs and low-res
 * Snapchat exports). Idempotent — keyed on sha1 of the original file.
 */
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";
import { LARGEST_VARIANT_WIDTH, MEDIA_BUCKET } from "../src/lib/media-spec";
import {
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
  buildVariants,
  ffAvailable,
  probeVideo,
  processVideo,
  readExif,
  uploadWithRetry,
} from "./lib/media-pipeline";

dotenv.config({ path: ".env.local", quiet: true });

const PREFIX = "nabawi";
const MAX_VIDEO_SECONDS = 20;
const MIN_VIDEO_SHORT_SIDE = 720;
const MANIFEST = path.join("src", "lib", "nabawi-media.ts");

type Entry = {
  kind: "photo" | "video";
  url: string;
  poster?: string;
  width: number;
  height: number;
  durationSeconds?: number;
  takenAt: number; // epoch ms, for ordering; 0 when unknown
  file: string;
};

function parseArgs(argv: string[]): { dir: string; dryRun: boolean } {
  const i = argv.indexOf("--dir");
  if (i === -1 || !argv[i + 1]) {
    console.error('Usage: npx tsx scripts/build-nabawi.ts --dir "<folder>" [--dry-run]');
    process.exit(1);
  }
  return { dir: argv[i + 1], dryRun: argv.includes("--dry-run") };
}

/** curl handles multi-MB bodies on a slow uplink where Node's fetch gives up. */
function uploadViaCurl(
  baseUrl: string,
  key: string,
  objectPath: string,
  filePath: string,
  contentType: string
): void {
  const res = spawnSync(
    "curl",
    [
      "-s", "--retry", "4", "--retry-delay", "5", "--retry-all-errors",
      "-X", "POST", `${baseUrl}/storage/v1/object/${MEDIA_BUCKET}/${objectPath}`,
      "-H", `Authorization: Bearer ${key}`, "-H", `apikey: ${key}`,
      "-H", `Content-Type: ${contentType}`, "-H", "x-upsert: true",
      "--data-binary", `@${filePath}`,
      "-o", "/dev/null", "-w", "%{http_code}",
    ],
    { encoding: "utf8" }
  );
  if (res.error || !/^2\d\d$/.test(res.stdout.trim())) {
    throw new Error(`curl upload ${objectPath}: ${res.error?.message ?? `HTTP ${res.stdout}`}`);
  }
}

async function main(): Promise<void> {
  const { dir, dryRun } = parseArgs(process.argv.slice(2));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing in .env.local");
    process.exit(1);
  }
  if (!ffAvailable()) {
    console.error("ffmpeg/ffprobe not on PATH");
    process.exit(1);
  }
  const supabase = createClient<Database>(url, key, { auth: { persistSession: false } });
  const publicUrl = (objectPath: string) =>
    supabase.storage.from(MEDIA_BUCKET).getPublicUrl(objectPath).data.publicUrl;

  const files = (await readdir(dir)).sort((a, b) => a.localeCompare(b));
  const workDir = await mkdtemp(path.join(os.tmpdir(), "nabawi-"));
  const entries: Entry[] = [];
  let skipped = 0;

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const fullPath = path.join(dir, file);
    if (!(await stat(fullPath)).isFile()) continue;

    try {
      if (IMAGE_EXTENSIONS.has(ext)) {
        const buffer = await readFile(fullPath);
        const base = createHash("sha1").update(buffer).digest("hex").slice(0, 10);
        const exif = await readExif(buffer);
        const { variants, outWidth, outHeight } = await buildVariants(buffer);
        if (!dryRun) {
          for (const v of variants) {
            const objectPath = `${PREFIX}/${base}-${v.width}.${v.ext}`;
            await uploadWithRetry(
              () =>
                supabase.storage.from(MEDIA_BUCKET).upload(objectPath, v.buffer, {
                  contentType: v.ext === "webp" ? "image/webp" : "image/jpeg",
                  upsert: true,
                  cacheControl: "31536000",
                }),
              objectPath
            );
          }
        }
        entries.push({
          kind: "photo",
          url: publicUrl(`${PREFIX}/${base}-${LARGEST_VARIANT_WIDTH}.webp`),
          width: outWidth,
          height: outHeight,
          takenAt: exif.takenAt?.getTime() ?? 0,
          file,
        });
        console.log(`photo  ${file} (${outWidth}x${outHeight})`);
      } else if (VIDEO_EXTENSIONS.has(ext)) {
        const probe = probeVideo(fullPath);
        if (
          probe.durationSeconds > MAX_VIDEO_SECONDS ||
          Math.min(probe.width, probe.height) < MIN_VIDEO_SHORT_SIDE
        ) {
          skipped++;
          console.log(`skip   ${file} (${probe.durationSeconds.toFixed(1)}s, ${probe.width}x${probe.height})`);
          continue;
        }
        const base = createHash("sha1").update(await readFile(fullPath)).digest("hex").slice(0, 10);
        const video = await processVideo(fullPath, probe, workDir);
        const mp4Path = `${PREFIX}/${base}.mp4`;
        const posterPath = `${PREFIX}/${base}-poster-800.jpg`;
        if (!dryRun) {
          const tmpMp4 = path.join(workDir, `${base}.mp4`);
          await writeFile(tmpMp4, video.buffer);
          uploadViaCurl(url, key, mp4Path, tmpMp4, "video/mp4");
          if (video.poster) {
            await uploadWithRetry(
              () =>
                supabase.storage.from(MEDIA_BUCKET).upload(posterPath, video.poster!.buffer, {
                  contentType: "image/jpeg",
                  upsert: true,
                  cacheControl: "31536000",
                }),
              posterPath
            );
          }
        }
        entries.push({
          kind: "video",
          url: publicUrl(mp4Path),
          poster: video.poster ? publicUrl(posterPath) : undefined,
          width: video.poster?.width ?? probe.width,
          height: video.poster?.height ?? probe.height,
          durationSeconds: Math.round(video.durationSeconds),
          takenAt: probe.takenAt?.getTime() ?? 0,
          file,
        });
        console.log(
          `video  ${file} (${Math.round(video.durationSeconds)}s → ${(video.buffer.length / 1024 / 1024).toFixed(1)} MB)`
        );
      }
    } catch (err) {
      console.error(`FAILED ${file}: ${err instanceof Error ? err.message : err}`);
      process.exitCode = 1;
    }
  }
  await rm(workDir, { recursive: true, force: true });

  // Chronological, like a visit; undated last by filename.
  entries.sort((a, b) => (a.takenAt && b.takenAt ? a.takenAt - b.takenAt : a.takenAt ? -1 : b.takenAt ? 1 : a.file.localeCompare(b.file)));

  const manifest = `// GENERATED by scripts/build-nabawi.ts — do not edit by hand.
// المسجد النبوي chapter of /tour: ${entries.filter((e) => e.kind === "photo").length} photos,
// ${entries.filter((e) => e.kind === "video").length} videos, served from Supabase Storage (nabawi/).

export type NabawiMedia = {
  kind: "photo" | "video";
  url: string;
  poster?: string;
  width: number;
  height: number;
  durationSeconds?: number;
};

export const NABAWI_MEDIA: NabawiMedia[] = [
${entries
  .map((e) => {
    const parts = [`kind: "${e.kind}"`, `url: "${e.url}"`];
    if (e.poster) parts.push(`poster: "${e.poster}"`);
    parts.push(`width: ${e.width}`, `height: ${e.height}`);
    if (e.durationSeconds != null) parts.push(`durationSeconds: ${e.durationSeconds}`);
    return `  { ${parts.join(", ")} },`;
  })
  .join("\n")}
];
`;
  if (!dryRun) await writeFile(MANIFEST, manifest);
  console.log(
    `\n${entries.length} entries (${skipped} video(s) skipped)${dryRun ? " [dry run]" : ` → ${MANIFEST}`}`
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
