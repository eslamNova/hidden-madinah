/**
 * import-claims — loads drafted claims from content/claims/<slug>.json into
 * the database as `pending`, after strict validation against the source.
 *
 *   npx tsx scripts/import-claims.ts                 # all files
 *   npx tsx scripts/import-claims.ts --place bir-ghars
 *   npx tsx scripts/import-claims.ts --replace       # delete that place's PENDING claims first
 *   npx tsx scripts/import-claims.ts --dry-run
 *
 * Drafts are written by an AI assistant in the development pipeline (Claude),
 * reading .cache/wafa/<slug>.json (scripts/content/build_wafa_corpus.py).
 * Nothing a draft says is trusted: each claim must point at a corpus
 * paragraph, and its verbatim excerpt must be found in that paragraph
 * (diacritics/punctuation-insensitive). Failing claims are reported and
 * skipped. Verified and rejected claims are never touched.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database, Enums, TablesInsert } from "../src/lib/database.types";

dotenv.config({ path: ".env.local", quiet: true });

type Passage = { vol: number; page: number; text: string; samarrai: { vol: number; page: number } | null };
type Draft = {
  paragraph: number;
  text_ar: string;
  text_en?: string;
  quote_ar: string;
  kind: Enums<"claim_kind">;
  content_level: Enums<"content_level">;
  themes?: string[];
  hadith_ref?: string;
  grading?: string;
};

const KINDS = new Set(["fact", "virtue", "humane", "practical"]);
const LEVELS = new Set(["A", "B", "C"]);
const TOPIC_SLUGS = new Set(["nabawi"]);

const squash = (s: string) =>
  s
    .replace(/[ؐ-ًؚ-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[«»"“”'()[\]{}،,.:؛;!؟?\-–—…ـ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

async function main() {
  const args = process.argv.slice(2);
  const only = args.includes("--place") ? args[args.indexOf("--place") + 1] : undefined;
  const replace = args.includes("--replace");
  const dryRun = args.includes("--dry-run");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing in .env.local");
  const db = createClient<Database>(url, key, { auth: { persistSession: false } });
  const { data: places, error: placesErr } = await db.from("places").select("id, slug");
  if (placesErr) throw placesErr;
  const placeId = new Map((places ?? []).map((p) => [p.slug, p.id]));

  const dir = path.join("content", "claims");
  let totalOk = 0;
  let totalBad = 0;
  for (const file of (await readdir(dir)).filter((f) => f.endsWith(".json"))) {
    const slug = file.replace(/\.json$/, "");
    if (only && slug !== only) continue;
    const corpus = JSON.parse(await readFile(path.join(".cache", "wafa", `${slug}.json`), "utf8")) as { passages: Passage[] };
    const drafts = JSON.parse(await readFile(path.join(dir, file), "utf8")) as Draft[];
    const isTopic = TOPIC_SLUGS.has(slug);
    const pid = isTopic ? null : placeId.get(slug);
    if (!isTopic && !pid) {
      console.warn(`skip ${slug}: no place row`);
      continue;
    }

    const rows: TablesInsert<"claims">[] = [];
    const problems: string[] = [];
    drafts.forEach((d, i) => {
      const p = corpus.passages[d.paragraph];
      const where = `#${i} (P${d.paragraph})`;
      if (!p) return problems.push(`${where}: no such paragraph`);
      if (!d.text_ar?.trim()) return problems.push(`${where}: empty text_ar`);
      if (!KINDS.has(d.kind)) return problems.push(`${where}: bad kind ${d.kind}`);
      if (!LEVELS.has(d.content_level)) return problems.push(`${where}: bad level ${d.content_level}`);
      const q = squash(d.quote_ar ?? "");
      if (q.length < 20) return problems.push(`${where}: quote too short`);
      if (!squash(p.text).includes(q)) return problems.push(`${where}: quote not found verbatim: «${d.quote_ar.slice(0, 60)}…»`);
      rows.push({
        place_id: pid ?? null,
        topic: isTopic ? slug : null,
        text_ar: d.text_ar.trim(),
        text_en: d.text_en?.trim() || null,
        quote_ar: d.quote_ar.trim(),
        source_id: "wafa-dki",
        vol: p.vol,
        page: p.page,
        samarrai_ref: p.samarrai ? `ج${p.samarrai.vol} ص${p.samarrai.page}` : null,
        needs_samarrai_check: true,
        hadith_ref: d.hadith_ref?.trim() || null,
        grading: d.grading?.trim() || null,
        kind: d.kind,
        content_level: d.content_level,
        themes: d.themes ?? [],
        status: "pending",
      });
    });

    totalOk += rows.length;
    totalBad += problems.length;
    console.log(`${slug}: ${rows.length} valid, ${problems.length} rejected`);
    for (const pr of problems) console.log(`   ✗ ${pr}`);
    if (dryRun) continue;

    if (replace) {
      const del = db.from("claims").delete().eq("status", "pending");
      const { error } = await (isTopic ? del.is("place_id", null).eq("topic", slug) : del.eq("place_id", pid!));
      if (error) throw error;
    }
    if (rows.length) {
      const { error } = await db.from("claims").insert(rows);
      if (error) throw error;
    }
  }
  console.log(`\ntotal: ${totalOk} imported${dryRun ? " (dry run)" : ""}, ${totalBad} rejected by validation`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
