/**
 * extract-claims — turns the per-place Wafa al-Wafa corpus into atomic,
 * cited claims and stores them as `pending` for human review.
 *
 *   npx tsx scripts/extract-claims.ts                    # every place without claims yet
 *   npx tsx scripts/extract-claims.ts --place masjid-quba
 *   npx tsx scripts/extract-claims.ts --place masjid-quba --replace   # redo (pending only)
 *   npx tsx scripts/extract-claims.ts --dry-run
 *
 * Needs: .cache/wafa/*.json (scripts/content/build_wafa_corpus.py),
 *        GEMINI_API_KEY + GEMINI_MODEL_SMART, NEXT_PUBLIC_SUPABASE_URL,
 *        SUPABASE_SERVICE_ROLE_KEY in .env.local.
 *
 * Anti-hallucination: every claim must carry a verbatim excerpt that is found,
 * character for character (whitespace-normalised), inside the paragraph it
 * cites. Claims whose excerpt can't be found are dropped, not "fixed".
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { Database, Enums, TablesInsert } from "../src/lib/database.types";
import { generateJson } from "../src/lib/ai/gemini";

dotenv.config({ path: ".env.local", quiet: true });

type Passage = {
  vol: number;
  page: number;
  pg: number;
  headings: string[];
  text: string;
  samarrai: { vol: number; page: number; score: number } | null;
};
type Corpus = { slug: string; source_id: string; passages: Passage[] };

type Extracted = {
  claims: {
    paragraph: number;
    text_ar: string;
    quote_ar: string;
    kind: Enums<"claim_kind">;
    content_level: Enums<"content_level">;
    themes: string[];
    hadith_ref: string;
    grading: string;
  }[];
};

const THEMES = ["mercy", "forgiveness", "humility", "loyalty", "neighbourliness", "courage", "patience", "brotherhood", "generosity", "worship"];
const TOPIC_SLUGS = new Set(["nabawi"]);
const BATCH_CHARS = 60000; // one request per place: free-tier quotas count requests, not tokens

const SYSTEM = `أنت باحث مساعد في السيرة النبوية وتاريخ المدينة المنورة، تعمل تحت إشراف مراجع شرعي.
مهمتك: استخراج معلومات ذرّية موثّقة من نص «وفاء الوفاء بأخبار دار المصطفى» للسمهودي (ت 911هـ)، تخدم زائر الموضع المذكور.

قواعد صارمة:
1. لا تستعمل أي معرفة من خارج الفقرات المعطاة. كل معلومة يجب أن تكون منصوصة في فقرة واحدة محددة.
2. text_ar: صياغة عربية معاصرة واضحة في جملة أو جملتين، أمينة للنص، بلا زيادة ولا مبالغة ولا تعميم.
3. quote_ar: مقتطف حرفي منسوخ من الفقرة نفسها كما هو تمامًا (بين 40 و220 حرفًا)، يدعم المعلومة.
4. نسبة الأقوال: إن كان الكلام رأيًا للسمهودي أو لغيره أو موضع خلاف فانسبه: «ذكر السمهودي…»، «قال ابن النجار…»، «اختُلف في…»، واجعل content_level = C.
5. أوصاف المكان في زمن المؤلف (القرن التاسع الهجري) تُذكر بصيغة تاريخية: «كان في زمن السمهودي…»، لا بصيغة الحاضر.
6. hadith_ref: فقط إذا ذكرت الفقرة صراحةً من أخرج الحديث (مثل: رواه البخاري / الترمذي)، وإلا اتركه فارغًا. grading: فقط إذا نصت الفقرة على الحكم (مثل: حسن غريب)، وإلا فارغ.
7. الفضل (kind=virtue) لا يُذكر إلا إذا ورد بحديث أو أثر منصوص في الفقرة. لا تنسب فضيلة لمكان دون نص.
8. kind=humane للمواقف الإنسانية للنبي ﷺ (رحمة، عفو، تواضع، وفاء، حسن جوار، شجاعة، مؤاخاة…) مع themes مناسبة.
9. تجاهل: مناقشات الأسانيد البحتة، الأذرع والمقاسات الدقيقة غير المهمة للزائر، الأخبار غير المتعلقة بالموضع.
10. content_level: A معلومة تاريخية أو حديثية ثابتة منصوصة؛ B شرح أو سياق؛ C خلاف أو قول مرجوح أو تحديد موضع غير قطعي. لا تستخرج ما يدخل في الفتوى الشخصية (D).
11. اختر أهم المعلومات للزائر وأكثرها فائدة، بحد أقصى {MAX} معلومة لهذه الدفعة، ولا تكرر معلومة.`;

const SCHEMA = {
  type: "object",
  properties: {
    claims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          paragraph: { type: "integer", description: "رقم الفقرة P التي تنص على المعلومة" },
          text_ar: { type: "string" },
          quote_ar: { type: "string" },
          kind: { type: "string", enum: ["fact", "virtue", "humane", "practical"] },
          content_level: { type: "string", enum: ["A", "B", "C"] },
          themes: { type: "array", items: { type: "string", enum: THEMES } },
          hadith_ref: { type: "string" },
          grading: { type: "string" },
        },
        required: ["paragraph", "text_ar", "quote_ar", "kind", "content_level", "themes", "hadith_ref", "grading"],
      },
    },
  },
  required: ["claims"],
};

const squash = (s: string) =>
  s
    .replace(/[ؐ-ًؚ-ٰٟـ]/g, "")
    .replace(/[«»"“”'()[\]،,.:؛;!؟?\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function batches(passages: Passage[]): { start: number; items: Passage[] }[] {
  const out: { start: number; items: Passage[] }[] = [];
  let cur: Passage[] = [];
  let size = 0;
  let start = 0;
  passages.forEach((p, i) => {
    if (size + p.text.length > BATCH_CHARS && cur.length) {
      out.push({ start, items: cur });
      cur = [];
      size = 0;
      start = i;
    }
    cur.push(p);
    size += p.text.length;
  });
  if (cur.length) out.push({ start, items: cur });
  return out;
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt >= 4) throw err;
      const wait = /429|RESOURCE_EXHAUSTED|quota/i.test(msg) ? 30_000 * attempt : 4_000 * attempt;
      console.warn(`  ${label}: ${msg.slice(0, 120)} — retry in ${wait / 1000}s`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const only = args.includes("--place") ? args[args.indexOf("--place") + 1] : undefined;
  const replace = args.includes("--replace");
  const dryRun = args.includes("--dry-run");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing in .env.local");
  const db = createClient<Database>(url, key, { auth: { persistSession: false } });

  const dir = path.join(".cache", "wafa");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  const { data: places, error: placesErr } = await db.from("places").select("id, slug");
  if (placesErr) throw placesErr;
  const placeId = new Map((places ?? []).map((p) => [p.slug, p.id]));

  for (const file of files) {
    const corpus = JSON.parse(await readFile(path.join(dir, file), "utf8")) as Corpus;
    const slug = corpus.slug;
    if (only && slug !== only) continue;
    const isTopic = TOPIC_SLUGS.has(slug);
    const pid = isTopic ? null : placeId.get(slug);
    if (!isTopic && !pid) {
      console.warn(`skip ${slug}: no place row`);
      continue;
    }

    const existing = db.from("claims").select("id", { count: "exact", head: true });
    const { count } = await (isTopic ? existing.is("place_id", null).eq("topic", slug) : existing.eq("place_id", pid!));
    if (count && !replace) {
      console.log(`skip ${slug}: already has ${count} claims (use --replace)`);
      continue;
    }
    if (replace && !dryRun) {
      const del = db.from("claims").delete().eq("status", "pending");
      await (isTopic ? del.is("place_id", null).eq("topic", slug) : del.eq("place_id", pid!));
    }

    const totalChars = corpus.passages.reduce((n, p) => n + p.text.length, 0);
    const parts = batches(corpus.passages);
    // Budget claims by how much source text the place has (bigger chapters → more claims).
    const maxPerBatch = Math.max(12, Math.min(30, Math.round(totalChars / 1500)));
    console.log(`${slug}: ${corpus.passages.length} paragraphs, ${totalChars} chars, ${parts.length} batch(es)`);

    const rows: TablesInsert<"claims">[] = [];
    let dropped = 0;
    for (const [bi, part] of parts.entries()) {
      const numbered = part.items
        .map((p, i) => {
          const heading = p.headings.length ? ` | ${p.headings.join(" / ")}` : "";
          return `[P${part.start + i}] (ج${p.vol} ص${p.page}${heading})\n${p.text}`;
        })
        .join("\n\n");
      const prompt = `الموضع: ${slug}\n\nالفقرات:\n\n${numbered}\n\nاستخرج المعلومات وفق القواعد.`;
      const { data, usage } = await withRetry(
        () =>
          generateJson<Extracted>({
            tier: "smart",
            system: SYSTEM.replace("{MAX}", String(maxPerBatch)),
            prompt,
            schema: SCHEMA,
          }),
        `${slug} batch ${bi + 1}`
      );
      for (const c of data.claims) {
        const p = corpus.passages[c.paragraph];
        if (!p || !squash(p.text).includes(squash(c.quote_ar)) || squash(c.quote_ar).length < 25) {
          dropped++;
          continue;
        }
        rows.push({
          place_id: pid ?? null,
          topic: isTopic ? slug : null,
          text_ar: c.text_ar.trim(),
          quote_ar: c.quote_ar.trim(),
          source_id: corpus.source_id,
          vol: p.vol,
          page: p.page,
          samarrai_ref: p.samarrai ? `ج${p.samarrai.vol} ص${p.samarrai.page}` : null,
          needs_samarrai_check: true,
          hadith_ref: c.hadith_ref.trim() || null,
          grading: c.grading.trim() || null,
          kind: c.kind,
          content_level: c.content_level,
          themes: c.themes,
          status: "pending",
        });
      }
      console.log(`  batch ${bi + 1}/${parts.length}: +${data.claims.length} proposed (in ${usage.inputTokens} / out ${usage.outputTokens} tokens)`);
    }

    console.log(`  ${rows.length} kept, ${dropped} dropped (excerpt not found verbatim)`);
    if (dryRun) {
      for (const r of rows.slice(0, 5)) console.log(`   · ${r.text_ar}  [ج${r.vol} ص${r.page}]`);
      continue;
    }
    if (rows.length) {
      const { error } = await db.from("claims").insert(rows);
      if (error) throw error;
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
