import type { Lang } from "@/lib/i18n";
import { REFERRAL_LINE, REFUSAL, RELIGIOUS_REFERRAL, type AnswerType } from "@/lib/guide/prompt";

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
 * The language of the reply (and of the refusal and referral lines): the
 * question's script decides. Arabic pages keep their original rule (a tie —
 * digits or punctuation only — is Arabic); on English pages a tie is English,
 * and only a question written mostly in Arabic gets an Arabic reply.
 */
export function replyLanguage(question: string, pageLang: Lang = "ar"): Lang {
  const arabic = (question.match(/[؀-ۿ]/g) ?? []).length;
  const latin = (question.match(/[A-Za-z]/g) ?? []).length;
  if (pageLang === "en") return arabic > latin ? "ar" : "en";
  return arabic >= latin ? "ar" : "en";
}

/**
 * Questions a computed, uncited "practical" answer may serve. Anything else
 * labelled practical without citations is judged like a factual answer.
 */
const PRACTICAL_AR_RE =
  /كم\s|يبعد|بُعد|مسافة|أمشي|امشي|مشيًا|مشيا|تاكسي|سيارة|أجرة|مواصلات|مفتوح|يفتح|يغلق|أوقات|وقت الزيارة|درج|كبار السن|كبير السن|كرسي|عربية|أقرب|قريب|موقف/;

// English: whole words only ("car" must not match "care", "near" not "nearly"),
// and phrasings that ask about the visit rather than about history ("how long
// does it take" is practical, "how long did the Prophet stay" is not; "walked",
// "entry into Madinah" and "the qibla direction" are left to the citation rule).
const PRACTICAL_EN_RE = new RegExp(
  [
    String.raw`\bhow\s+(?:far|close|near)\b`,
    String.raw`\bfar\s+(?:from|away)\b`,
    String.raw`\b(?:is|are)\s+(?:it|this|that|they|these)\s+(?:far|close|near)\b`,
    String.raw`\bdirections\b`, // plural only: "the qibla direction" is history
    String.raw`\bhow\s+(?:long|much\s+time)\s+(?:does|do|will|would|should|can|to)\b`,
    String.raw`\bhow\s+long\s+is\s+the\s+(?:walk|drive|ride|trip|journey|visit)\b`,
    String.raw`\bhow\s+(?:do|can|should|would)\s+(?:i|we)\s+(?:get|go|reach)\b`,
    String.raw`\bget(?:ting)?\s+there\b`,
    String.raw`\bdistances?\b`,
    String.raw`\b(?:km|kms|kilomet(?:er|re)s?|miles?|met(?:er|re)s)\b`,
    String.raw`\b(?:walk|walks|walking|walkable)\b`,
    String.raw`\bon\s+foot\b`,
    String.raw`\b(?:taxis?|cabs?|uber|careem|bus|buses|cars?|drive|driving|ride|park|parking|transport|transportation)\b`,
    String.raw`\b(?:open|opens|opening|closes|closed|closing|hours|timings?)\b`,
    String.raw`\b(?:when|what\s+time)\s+does\s+it\s+close\b`,
    String.raw`\bbest\s+time\b`,
    String.raw`\b(?:visiting|visit)\s+times?\b`,
    String.raw`\bwhen\s+(?:can|should)\s+(?:i|we)\s+(?:visit|go|come)\b`,
    String.raw`\b(?:crowded|crowds|busy)\b`,
    String.raw`\badmission\b`,
    String.raw`\bis\s+it\s+free\b`,
    String.raw`\bsuitable\s+for\b`,
    String.raw`\bwith\s+(?:kids|children|a\s+baby|babies|toddlers|a\s+pram)\b`,
    String.raw`\b(?:stairs|staircase|elevators?|lifts?|ramps?|wheelchairs?|strollers?|pushchairs?|accessible|accessibility|disabled|disability|mobility)\b`,
    String.raw`\b(?:are\s+there|any|many|no)\s+steps\b`,
    String.raw`\b(?:elderly|seniors?|old\s+(?:people|parents?|mother|father|man|woman))\b`,
    String.raw`\b(?:cost|costs|price|prices|fare|fares|fees?|tickets?|riyals?|sar)\b`,
    String.raw`\bhow\s+much\s+(?:is|does|do|will|would)\b`,
    String.raw`\b(?:nearest|nearby|closest)\b`,
    String.raw`\bnear\s+(?:me|here|by)\b`,
    String.raw`\bclose\s+(?:by|to\s+(?:me|here))\b`,
    String.raw`\bnext\s+stop\b`,
    String.raw`\b(?:toilets?|restrooms?|washrooms?|bathrooms?|wudu|ablution)\b`,
  ].join("|"),
  "i"
);

export function isPracticalQuestion(question: string): boolean {
  return PRACTICAL_AR_RE.test(question) || PRACTICAL_EN_RE.test(question);
}

/**
 * The server guard. Judged on content, not on the model's own label: a
 * "practical" reply without citations is accepted only for a practical
 * question; an answer that cites nothing valid becomes the refusal. Same rules
 * in both languages — only the canonical refusal/referral wording follows `lang`.
 */
export function guardAnswer(opts: {
  raw: string;
  question: string;
  allowed: { has: (id: number) => boolean };
  lang: Lang;
}): { type: AnswerType; text: string; valid: number[] } {
  const parsed = parseAnswer(opts.raw);
  let type: AnswerType = parsed.type;
  const norm = normaliseCitations(parsed.body, opts.allowed);
  let text = norm.text;
  const valid = norm.valid;
  if (type === "practical" && valid.length === 0 && !isPracticalQuestion(opts.question)) type = "answer";
  if (type === "answer" && valid.length === 0) {
    type = "refuse";
    text = `${REFUSAL[opts.lang]}\n${REFERRAL_LINE[opts.lang]}`;
  } else if (type === "refuse") {
    text = `${REFUSAL[opts.lang]}\n${REFERRAL_LINE[opts.lang]}`;
  } else if (type === "refer" && !text.includes(RELIGIOUS_REFERRAL)) {
    text = `${text}\n${REFERRAL_LINE[opts.lang]}`;
  }
  return { type, text, valid };
}
