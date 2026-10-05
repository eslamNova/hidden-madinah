/**
 * dump-ar-content — writes the Arabic text English pages need translated
 * (published places, their media captions, routes) to a JSON file, exactly as
 * the public pages display it ([VERIFY] markers stripped).
 *
 *   npx tsx scripts/i18n/dump-ar-content.mts <out.json>
 */
import { writeFile } from "node:fs/promises";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { stripVerify } from "../../src/lib/content";
import { PLACE_TEXT_FIELDS } from "../../src/lib/i18n-content";

dotenv.config({ path: ".env.local", quiet: true });

async function main() {
  const out = process.argv[2];
  if (!out) throw new Error("usage: dump-ar-content.mts <out.json>");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: places, error } = await db.from("places").select("*, media(id, caption_ar, sort_order)").eq("is_published", true).order("slug");
  if (error) throw error;
  const { data: routes, error: rErr } = await db.from("routes").select("slug, title_ar, description_ar").order("slug");
  if (rErr) throw rErr;

  const dump = {
    places: Object.fromEntries(
      (places ?? []).map((p) => {
        const fields: Record<string, string> = {};
        for (const f of PLACE_TEXT_FIELDS) {
          const v = f === "name" ? p.name_ar : stripVerify(p[`${f}_ar` as keyof typeof p] as string | null);
          if (v) fields[f] = v;
        }
        const transport = Array.isArray(p.transport_options)
          ? (p.transport_options as { mode_ar?: string; note_ar?: string }[]).map((o) => ({ mode: o.mode_ar ?? "", note: o.note_ar ?? "" }))
          : [];
        const captions = Object.fromEntries(
          ((p.media ?? []) as { id: string; caption_ar: string | null }[]).flatMap((m) => {
            const c = stripVerify(m.caption_ar);
            return c ? [[m.id, c]] : [];
          })
        );
        return [p.slug, { name_en_db: p.name_en, fields, transport, captions }];
      })
    ),
    routes: Object.fromEntries(
      (routes ?? []).map((r) => [r.slug, { title: r.title_ar, description: stripVerify(r.description_ar) ?? "" }])
    ),
  };
  await writeFile(out, JSON.stringify(dump, null, 2), "utf8");
  console.log(`places ${Object.keys(dump.places).length}, routes ${Object.keys(dump.routes).length} → ${out}`);
}
main();
