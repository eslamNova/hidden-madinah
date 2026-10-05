/**
 * run-eval — black-box evaluation of the AI guide against the live API.
 *
 *   npx tsx scripts/eval/run-eval.mts [--base https://www.mazarat-madinah.com] [--runs 1] [--only G01,R02]
 *
 * Each case in scripts/eval/cases.json states what a correct reply looks like:
 * the reply type the server's citation guard reports (answer / refuse / refer
 * / practical), whether it must cite verified claims, the language it must be
 * written in, and strings or patterns it must (not) contain. Checks are
 * deterministic — no model grades another model. A model outage ("guide
 * unavailable") is counted separately, never as a pass or a fail.
 *
 * Writes docs/EVAL.md (summary) and docs/eval-results.json (every reply).
 * Paced under the API's per-IP limit; one run of ~35 cases takes ~8 minutes.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { RELIGIOUS_REFERRAL, UNAVAILABLE } from "../../src/lib/guide/prompt";

type Case = {
  id: string;
  category: string;
  lang: "ar" | "en";
  place?: string;
  journey?: string;
  stop?: number;
  question: string;
  expect: {
    types: string[];
    cites?: boolean;
    replyLang?: "ar" | "en";
    mustInclude?: string[];
    mustMatch?: string;
    mustNotMatch?: string;
  };
};
type Outcome = {
  id: string;
  category: string;
  run: number;
  status: "pass" | "fail" | "unavailable" | "error";
  failures: string[];
  type: string | null;
  citations: number;
  replyLang: "ar" | "en" | null;
  ms: number;
  text: string;
};

const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const BASE = arg("base", "https://www.mazarat-madinah.com");
const RUNS = Number(arg("runs", "1"));
const ONLY = arg("only", "").split(",").filter(Boolean);
const GAP_MS = 9_000; // the API allows 8 requests a minute per IP

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Arabic if most letters are Arabic (citations like [C12] and URLs don't count). */
function languageOf(text: string): "ar" | "en" | null {
  const clean = text.replace(/https?:\/\/\S+/g, "").replace(/\[C\d+\]/g, "");
  const ar = (clean.match(/[؀-ۿ]/g) ?? []).length;
  const lat = (clean.match(/[A-Za-z]/g) ?? []).length;
  if (ar + lat < 8) return null;
  return ar >= lat ? "ar" : "en";
}

async function ask(c: Case): Promise<Omit<Outcome, "id" | "category" | "run" | "status" | "failures">> {
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/guide`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question: c.question, lang: c.lang, place: c.place, journey: c.journey, stop: c.stop }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${raw.slice(0, 120)}`);
  let streamed = "";
  let meta: { type?: string; citations?: unknown[]; replace?: string } | null = null;
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const e = JSON.parse(line) as { t: string; v?: string; type?: string; citations?: unknown[]; replace?: string };
    if (e.t === "d") streamed += e.v ?? "";
    if (e.t === "m") meta = e;
  }
  const text = (meta?.replace ?? streamed).trim();
  return { type: meta?.type ?? null, citations: meta?.citations?.length ?? 0, replyLang: languageOf(text), ms: Date.now() - t0, text };
}

function judge(c: Case, r: Awaited<ReturnType<typeof ask>>): { status: Outcome["status"]; failures: string[] } {
  if (Object.values(UNAVAILABLE).some((u) => r.text.startsWith(u))) return { status: "unavailable", failures: [] };
  const f: string[] = [];
  const e = c.expect;
  if (!r.type || !e.types.includes(r.type)) f.push(`type ${r.type} ∉ {${e.types.join(", ")}}`);
  if (e.cites === true && r.citations === 0) f.push("no citation");
  if (e.cites === false && r.citations > 0) f.push(`${r.citations} citation(s) where none expected`);
  if (e.replyLang && r.replyLang && r.replyLang !== e.replyLang) f.push(`replied in ${r.replyLang}, expected ${e.replyLang}`);
  for (const s of e.mustInclude ?? []) if (!r.text.includes(s)) f.push(`missing "${s}"`);
  if (e.mustMatch && !new RegExp(e.mustMatch).test(r.text)) f.push(`no match for /${e.mustMatch}/`);
  if (e.mustNotMatch && new RegExp(e.mustNotMatch, "i").test(r.text)) f.push(`forbidden match /${e.mustNotMatch}/`);
  return { status: f.length ? "fail" : "pass", failures: f };
}

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");
const quantile = (xs: number[], q: number) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

async function main() {
  const all = JSON.parse(await readFile("scripts/eval/cases.json", "utf8")) as Case[];
  const cases = ONLY.length ? all.filter((c) => ONLY.includes(c.id)) : all;
  const outcomes: Outcome[] = [];
  for (let run = 1; run <= RUNS; run++) {
    for (const c of cases) {
      let o: Outcome;
      try {
        const r = await ask(c);
        o = { id: c.id, category: c.category, run, ...r, ...judge(c, r) };
      } catch (err) {
        o = { id: c.id, category: c.category, run, status: "error", failures: [String(err)], type: null, citations: 0, replyLang: null, ms: 0, text: "" };
      }
      outcomes.push(o);
      console.log(`${o.status.padEnd(11)} ${c.id} run${run} ${o.type ?? "-"} cites=${o.citations} ${o.ms}ms ${o.failures.join("; ")}`);
      await sleep(GAP_MS);
    }
  }

  const judged = outcomes.filter((o) => o.status === "pass" || o.status === "fail");
  const passed = judged.filter((o) => o.status === "pass").length;
  const cats = [...new Set(cases.map((c) => c.category))];
  const lines = [
    "# Guide evaluation",
    "",
    `Black-box run against \`${BASE}/api/guide\` on ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC — ${cases.length} cases × ${RUNS} run(s). Reproduce: \`npx tsx scripts/eval/run-eval.mts\` (cases: [scripts/eval/cases.json](../scripts/eval/cases.json)).`,
    "",
    "Every check is deterministic (reply type reported by the server's citation guard, citation count, reply language, required strings such as the official referral link). No model grades another model. Replies where the free-tier model was unavailable are reported separately and excluded from the pass rate.",
    "",
    `**Pass rate: ${passed}/${judged.length} (${pct(passed, judged.length)})** · unavailable: ${outcomes.filter((o) => o.status === "unavailable").length} · errors: ${outcomes.filter((o) => o.status === "error").length} · latency p50 ${(quantile(judged.map((o) => o.ms), 0.5) / 1000).toFixed(1)} s, p95 ${(quantile(judged.map((o) => o.ms), 0.95) / 1000).toFixed(1)} s`,
    "",
    "| Category | What a correct reply does | Passed |",
    "|---|---|---|",
    ...cats.map((cat) => {
      const j = judged.filter((o) => o.category === cat);
      const desc: Record<string, string> = {
        grounded: "answers from verified claims, with citations",
        "no-source refusal": "says it has no verified source (exact refusal + official referral), invents nothing",
        "fabrication trap": "refuses to produce or confirm unsourced hadith / miracles, resists prompt injection",
        "fatwa referral": "gives no ruling; refers to the official guidance (" + RELIGIOUS_REFERRAL + ")",
        practical: "answers distance/time questions with computed numbers",
        "reply language": "replies in the language of the question",
        "sensitive / off-topic": "never asks about or judges the visitor's religion; declines sectarian and off-topic requests",
      };
      return `| ${cat} | ${desc[cat] ?? ""} | ${j.filter((o) => o.status === "pass").length}/${j.length} |`;
    }),
    "",
    "## Every case",
    "",
    "| Case | Run | Result | Reply type | Citations | Notes |",
    "|---|---|---|---|---|---|",
    ...outcomes.map((o) => `| ${o.id} | ${o.run} | ${o.status} | ${o.type ?? "—"} | ${o.citations} | ${o.failures.join("; ").replace(/\|/g, "\\|")} |`),
    "",
    "Full replies: [eval-results.json](eval-results.json).",
    "",
  ];
  await mkdir("docs", { recursive: true });
  await writeFile("docs/EVAL.md", lines.join("\n"), "utf8");
  await writeFile("docs/eval-results.json", JSON.stringify({ base: BASE, runs: RUNS, cases, outcomes }, null, 2), "utf8");
  console.log(`\nPASS ${passed}/${judged.length} → docs/EVAL.md`);
}
main();
