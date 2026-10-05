/**
 * assemble-en — turns reviewed translations into content/i18n/en.json, stamping
 * each English text with the hash of the Arabic it was translated from (the
 * site hides an English text once its Arabic changes).
 *
 *   npx tsx scripts/i18n/assemble-en.mts <ar-content.json> <translations.json>
 *
 * ar-content.json   output of dump-ar-content.mts
 * translations.json { "place-<slug>": [{ key, en }], "routes": [{ key, en }] }
 *                   keys: fields.<field> | transport.<i>.mode | transport.<i>.note
 *                   | captions.<mediaId> | routes.<slug>.title | routes.<slug>.description
 */
import { readFile, writeFile } from "node:fs/promises";
import { sourceHash } from "../../src/lib/i18n-content";

type Dump = {
  places: Record<string, { fields: Record<string, string>; transport: { mode: string; note: string }[]; captions: Record<string, string> }>;
  routes: Record<string, { title: string; description: string }>;
};
type Entry = { text: string; src: string };

async function main() {
  const [dumpPath, trPath] = process.argv.slice(2);
  if (!dumpPath || !trPath) throw new Error("usage: assemble-en.mts <ar-content.json> <translations.json>");
  const dump = JSON.parse(await readFile(dumpPath, "utf8")) as Dump;
  const tr = JSON.parse(await readFile(trPath, "utf8")) as Record<string, { key: string; en: string }[]>;
  const entry = (en: string | undefined, ar: string | undefined): Entry | null =>
    en?.trim() && ar?.trim() ? { text: en.trim(), src: sourceHash(ar) } : null;

  const out: { places: Record<string, unknown>; routes: Record<string, unknown> } = { places: {}, routes: {} };
  const missing: string[] = [];

  for (const [slug, p] of Object.entries(dump.places)) {
    const got = new Map((tr[`place-${slug}`] ?? []).map((e) => [e.key, e.en]));
    const fields: Record<string, Entry> = {};
    for (const [f, ar] of Object.entries(p.fields)) {
      const e = entry(got.get(`fields.${f}`), ar);
      if (e) fields[f] = e;
      else missing.push(`${slug} fields.${f}`);
    }
    const transport = p.transport.map((t, i) => ({
      mode: entry(got.get(`transport.${i}.mode`), t.mode),
      note: t.note ? entry(got.get(`transport.${i}.note`), t.note) : null,
    }));
    const captions: Record<string, Entry> = {};
    for (const [id, ar] of Object.entries(p.captions)) {
      const e = entry(got.get(`captions.${id}`), ar);
      if (e) captions[id] = e;
      else missing.push(`${slug} captions.${id}`);
    }
    out.places[slug] = { fields, transport, captions };
  }

  const routeTr = new Map((tr.routes ?? []).map((e) => [e.key, e.en]));
  for (const [slug, r] of Object.entries(dump.routes)) {
    out.routes[slug] = {
      title: entry(routeTr.get(`routes.${slug}.title`), r.title),
      ...(r.description ? { description: entry(routeTr.get(`routes.${slug}.description`), r.description) } : {}),
    };
  }

  await writeFile("content/i18n/en.json", JSON.stringify(out, null, 2) + "\n", "utf8");
  console.log(`places ${Object.keys(out.places).length}, routes ${Object.keys(out.routes).length}`);
  if (missing.length) console.log(`MISSING ${missing.length}:\n  ${missing.join("\n  ")}`);
}
main();
