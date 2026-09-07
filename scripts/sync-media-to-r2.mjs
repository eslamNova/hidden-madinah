/**
 * sync-media-to-r2 — copy new Supabase Storage objects to the R2 bucket that
 * actually serves them, then point their DB rows at the R2 domain.
 *
 * Usage:  node scripts/sync-media-to-r2.mjs [--dry-run]
 * Needs:  .env.local (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
 *         and a logged-in wrangler (`npx wrangler login`).
 *
 * Why: uploads (admin UI, import-media, build-nabawi) land in Supabase
 * Storage and write supabase.co URLs, but the public site serves media from
 * MEDIA_PUBLIC_BASE (R2, zero egress). Run this after every content import,
 * before deploying. Idempotent — objects already on R2 are skipped, rows
 * already swapped are untouched.
 *
 * Deliberately SERIAL: parallel wrangler processes race the shared OAuth
 * token refresh and log the CLI out mid-run.
 */
import { readFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BUCKET_R2 = "mazarat-media";
const MEDIA_PUBLIC_BASE = "https://media.mazarat-madinah.com";
const CACHE = "public, max-age=31536000, immutable";
const DRY = process.argv.includes("--dry-run");

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);
const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SB_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL || !SB_KEY) throw new Error("Missing Supabase env in .env.local");
const SB_HEADERS = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
const SUPABASE_MEDIA_PREFIX = `${SB_URL}/storage/v1/object/public/media/`;

function contentType(key) {
  if (key.endsWith(".webp")) return "image/webp";
  if (key.endsWith(".jpg") || key.endsWith(".jpeg")) return "image/jpeg";
  if (key.endsWith(".mp4")) return "video/mp4";
  if (key.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

/** Every object in the Supabase `media` bucket, recursively. */
async function listSupabase(prefix = "") {
  const out = [];
  let offset = 0;
  for (;;) {
    const res = await fetch(`${SB_URL}/storage/v1/object/list/media`, {
      method: "POST",
      headers: { ...SB_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: "name", order: "asc" } }),
    });
    if (!res.ok) throw new Error(`list ${prefix}: HTTP ${res.status}`);
    const data = await res.json();
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) out.push(...(await listSupabase(path)));
      else out.push({ key: path, size: item.metadata?.size ?? null });
    }
    if (data.length < 1000) break;
    offset += 1000;
  }
  return out;
}

/** Is the object already live on R2 (same size)? Cache-busted so a stale CDN 404 can't lie. */
async function onR2(obj) {
  const res = await fetch(`${MEDIA_PUBLIC_BASE}/${obj.key}?sync=${Date.now()}`, { method: "HEAD" });
  if (!res.ok) return false;
  const len = Number(res.headers.get("content-length"));
  return obj.size === null || !Number.isFinite(len) || len === obj.size;
}

const objects = await listSupabase();
console.log(`Supabase bucket: ${objects.length} objects`);

const missing = [];
for (const obj of objects) if (!(await onR2(obj))) missing.push(obj);
console.log(`Missing on R2: ${missing.length}`);

let failed = 0;
if (!DRY && missing.length) {
  const work = mkdtempSync(join(tmpdir(), "r2sync-"));
  for (const obj of missing) {
    try {
      const res = await fetch(`${SUPABASE_MEDIA_PREFIX}${obj.key}`);
      if (!res.ok) throw new Error(`download HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (obj.size !== null && buf.length !== obj.size) throw new Error("size mismatch");
      const tmp = join(work, "obj.bin");
      writeFileSync(tmp, buf);
      const put = spawnSync(
        "npx",
        ["wrangler", "r2", "object", "put", `${BUCKET_R2}/${obj.key}`,
         "--file", tmp, "--content-type", contentType(obj.key),
         "--cache-control", CACHE, "--remote"],
        { shell: true, stdio: "pipe" }
      );
      if (put.status !== 0) throw new Error(`wrangler: ${put.stderr?.toString().slice(-200)}`);
      console.log(`ok   ${obj.key}`);
    } catch (e) {
      failed++;
      console.error(`FAIL ${obj.key}: ${e.message}`);
    }
  }
  rmSync(work, { recursive: true, force: true });
}

// Point DB rows that still carry supabase.co media URLs at the R2 domain.
const rows = await (
  await fetch(
    `${SB_URL}/rest/v1/media?select=id,url,thumb_url&or=(url.like.*supabase.co*,thumb_url.like.*supabase.co*)`,
    { headers: SB_HEADERS }
  )
).json();
console.log(`DB rows still on supabase.co URLs: ${rows.length}`);
if (!DRY && failed === 0) {
  for (const row of rows) {
    const patch = {};
    if (row.url?.startsWith(SUPABASE_MEDIA_PREFIX))
      patch.url = row.url.replace(SUPABASE_MEDIA_PREFIX, `${MEDIA_PUBLIC_BASE}/`);
    if (row.thumb_url?.startsWith(SUPABASE_MEDIA_PREFIX))
      patch.thumb_url = row.thumb_url.replace(SUPABASE_MEDIA_PREFIX, `${MEDIA_PUBLIC_BASE}/`);
    if (!Object.keys(patch).length) continue;
    const res = await fetch(`${SB_URL}/rest/v1/media?id=eq.${row.id}`, {
      method: "PATCH",
      headers: { ...SB_HEADERS, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) { failed++; console.error(`FAIL row ${row.id}: HTTP ${res.status}`); }
  }
} else if (rows.length && failed > 0) {
  console.log("Skipping DB swap — fix upload failures first.");
}

console.log(`DONE${DRY ? " (dry run)" : ""} — uploads missing: ${missing.length}, failures: ${failed}`);
process.exit(failed ? 1 : 0);
