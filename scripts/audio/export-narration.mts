/**
 * export-narration — writes every journey stop's narration text to one .txt
 * file per audio file to record (e.g. with ElevenLabs), plus an index.
 *
 *   npx tsx scripts/audio/export-narration.mts [outDir=my_data/tts]
 *
 * File names are the names the recorded MP3s must have:
 *   <journey>-<stop>-ar.txt / -kids-ar.txt / -en.txt  →  same name with .mp3
 * The text is exactly what the site shows, made speakable: ﷺ written out,
 * Quran brackets and guillemets dropped (the words stay).
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local", quiet: true });

const speakable = (text: string, lang: "ar" | "en") =>
  text
    .replace(/\s*ﷺ/g, lang === "ar" ? " صلى الله عليه وسلم" : " (peace be upon him)")
    .replace(/[﴿﴾«»]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();

async function main() {
  const out = process.argv[2] ?? "my_data/tts";
  await mkdir(out, { recursive: true });
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: journeys, error } = await db
    .from("journeys")
    .select("slug, title_ar, title_en, is_published, sort_order, journey_stops(sort_order, title_ar, title_en, script_ar, script_kids_ar, script_en, places(name_ar, name_en))")
    .order("sort_order");
  if (error) throw error;

  const rows: string[] = [];
  let files = 0;
  let chars = 0;
  for (const j of journeys ?? []) {
    const stops = [...(j.journey_stops ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    rows.push(`\n## ${j.is_published ? "★ PUBLISHED — record first: " : "Draft (not published yet): "}${j.title_ar} — ${j.title_en ?? ""} (${j.slug})\n`);
    rows.push("| File (save the MP3 with this exact name) | Stop | Language | Characters |", "|---|---|---|---|");
    for (const s of stops) {
      const place = (s.places as { name_ar: string; name_en: string | null } | null) ?? null;
      const stopName = s.title_ar || place?.name_ar || `stop ${s.sort_order}`;
      const items: [string, string | null, "ar" | "en", string][] = [
        ["ar", s.script_ar, "ar", "Arabic"],
        ["kids-ar", s.script_kids_ar, "ar", "Arabic — children's version"],
        ["en", s.script_en, "en", "English"],
      ];
      for (const [suffix, text, lang, label] of items) {
        if (!text?.trim()) continue;
        const name = `${j.slug}-${s.sort_order}-${suffix}`;
        const body = speakable(text, lang);
        await writeFile(path.join(out, `${name}.txt`), body + "\n", "utf8");
        rows.push(`| \`${name}.mp3\` | ${s.sort_order}. ${stopName} | ${label} | ${body.length} |`);
        files++;
        chars += body.length;
      }
    }
  }

  const index = [
    "# Narration texts for recording",
    "",
    "Each `.txt` file in this folder is one recording. Paste its text into ElevenLabs, generate, and save the MP3 with the **same name** (only the extension changes: `hijra-1-ar.txt` → `hijra-1-ar.mp3`). Put all MP3s in `my_data/tts/mp3/`.",
    "",
    `${files} recordings, ${chars.toLocaleString("en")} characters in total. Start with the published journey (★).`,
    "",
    "Tips: use the same voice for all Arabic files and the same voice for all English files; a multilingual model (e.g. Eleven Multilingual v2) for Arabic; MP3 44.1 kHz 128 kbps is plenty. The children's version can use a warmer voice.",
    ...rows,
    "",
  ].join("\n");
  await writeFile(path.join(out, "INDEX.md"), index, "utf8");
  console.log(`${files} files, ${chars} chars → ${out}`);
}
main();
