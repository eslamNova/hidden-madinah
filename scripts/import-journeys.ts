/**
 * import-journeys — loads drafted journey content (content/journeys/<slug>.json)
 * into journeys / journey_stops / quiz_items as PENDING for human review.
 *
 *   npx tsx scripts/import-journeys.ts                 # every file
 *   npx tsx scripts/import-journeys.ts --journey hijra
 *
 * Re-running overwrites the texts and resets those stops to pending (a changed
 * script must be re-reviewed). Quiz items are replaced. Journeys are never
 * auto-published. Run scripts/content/validate_journeys.py first.
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/database.types";

dotenv.config({ path: ".env.local", quiet: true });

type Draft = {
  slug: string;
  intro_ar: string;
  intro_en: string;
  stops: {
    stop_id: string;
    script_ar: string;
    script_en: string;
    script_kids_ar: string;
    human_moment_ar: string;
    human_moment_en: string;
    reflection_ar: string;
    reflection_en: string;
    claim_ids: number[];
  }[];
  quiz: {
    question_ar: string;
    question_en: string;
    options_ar: string[];
    options_en: string[];
    answer_index: number;
    explanation_claim_id: number;
  }[];
};

async function main() {
  const args = process.argv.slice(2);
  const only = args.includes("--journey") ? args[args.indexOf("--journey") + 1] : undefined;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing in .env.local");
  const db = createClient<Database>(url, key, { auth: { persistSession: false } });

  const dir = path.join("content", "journeys");
  for (const file of (await readdir(dir)).filter((f) => f.endsWith(".json"))) {
    const draft = JSON.parse(await readFile(path.join(dir, file), "utf8")) as Draft;
    if (only && draft.slug !== only) continue;

    const { data: journey, error: jErr } = await db
      .from("journeys")
      .update({ intro_ar: draft.intro_ar, intro_en: draft.intro_en })
      .eq("slug", draft.slug)
      .select("id")
      .single();
    if (jErr) throw new Error(`${draft.slug}: ${jErr.message}`);

    for (const s of draft.stops) {
      const { error } = await db
        .from("journey_stops")
        .update({
          script_ar: s.script_ar,
          script_en: s.script_en,
          script_kids_ar: s.script_kids_ar,
          human_moment_ar: s.human_moment_ar,
          human_moment_en: s.human_moment_en,
          reflection_ar: s.reflection_ar,
          reflection_en: s.reflection_en,
          claim_ids: s.claim_ids,
          status: "pending",
        })
        .eq("id", s.stop_id)
        .eq("journey_id", journey.id);
      if (error) throw new Error(`${draft.slug} stop ${s.stop_id}: ${error.message}`);
    }

    const { error: delErr } = await db.from("quiz_items").delete().eq("journey_id", journey.id);
    if (delErr) throw delErr;
    const { error: qErr } = await db.from("quiz_items").insert(
      draft.quiz.map((q, i) => ({
        journey_id: journey.id,
        sort_order: i + 1,
        question_ar: q.question_ar,
        question_en: q.question_en,
        options_ar: q.options_ar,
        options_en: q.options_en,
        answer_index: q.answer_index,
        explanation_claim_id: q.explanation_claim_id,
        status: "pending" as const,
      }))
    );
    if (qErr) throw qErr;
    console.log(`${draft.slug}: ${draft.stops.length} stops, ${draft.quiz.length} quiz items → pending review`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
