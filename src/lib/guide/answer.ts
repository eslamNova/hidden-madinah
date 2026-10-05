import type { AnswerType } from "@/lib/guide/prompt";

/**
 * Post-processing of a raw model reply, before the citation guard.
 * Models are sloppy with protocol tokens, so parsing is lenient on purpose:
 * a marker wrapped in **bold**, followed by a period, emitted twice or cut off
 * mid-way must never reach the visitor, and grouped citations like
 * [C12, C15] must count as citations.
 */

const TYPES: AnswerType[] = ["answer", "refuse", "refer", "practical"];
const MARKER_RE = /[*_`\s]*<<\s*type\s*:\s*([a-z]+)\s*>>[*_`.\s]*/gi;
const DANGLING_RE = /[*_`\s]*<<[^>]*$/;

export function parseAnswer(raw: string): { type: AnswerType; body: string } {
  let type: AnswerType = "answer";
  for (const m of raw.matchAll(MARKER_RE)) {
    const v = m[1].toLowerCase() as AnswerType;
    type = TYPES.includes(v) ? v : "answer";
  }
  const body = raw.replace(MARKER_RE, "\n").replace(DANGLING_RE, "").trim();
  return { type, body };
}

// [C12] · [C12, C15] · [C12،C15] · [C 12; 15] — at least one "C" so plain
// bracketed numbers in prose are left alone.
const GROUP_RE = /\[\s*(C\s*\d+(?:\s*[,،;]\s*C?\s*\d+)*)\s*\]/gi;

/**
 * Rewrites every citation group as separate [C<id>] tokens, keeping only ids
 * that exist in `allowed` (invented ids are dropped).
 */
export function normaliseCitations(
  text: string,
  allowed: { has: (id: number) => boolean }
): { text: string; valid: number[]; invented: number[] } {
  const valid: number[] = [];
  const invented: number[] = [];
  const out = text.replace(GROUP_RE, (_whole, inner: string) => {
    const ids = inner
      .split(/[,،;]/)
      .map((s) => Number(s.replace(/[^\d]/g, "")))
      .filter((n) => Number.isFinite(n) && n > 0);
    const kept = ids.filter((id) => {
      if (allowed.has(id)) {
        if (!valid.includes(id)) valid.push(id);
        return true;
      }
      if (!invented.includes(id)) invented.push(id);
      return false;
    });
    return kept.map((id) => `[C${id}]`).join("");
  });
  return { text: out.replace(/[ \t]+([.،,؛])/g, "$1"), valid, invented };
}

/**
 * Questions a computed, uncited "practical" answer may serve. Anything else
 * labelled practical without citations is judged like a factual answer.
 */
const PRACTICAL_RE =
  /كم\s|يبعد|بُعد|مسافة|أمشي|امشي|مشيًا|مشيا|تاكسي|سيارة|أجرة|مواصلات|مفتوح|يفتح|يغلق|أوقات|وقت الزيارة|درج|كبار السن|كبير السن|كرسي|عربية|أقرب|قريب|موقف|how far|distance|walk|taxi|car|ride|open|close|hours|stairs|elderly|wheelchair|nearest|near|parking/i;

export function isPracticalQuestion(question: string): boolean {
  return PRACTICAL_RE.test(question);
}
