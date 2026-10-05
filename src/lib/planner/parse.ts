import type { Companions, Interest, Mobility, Mode, StartKey } from "@/lib/planner/solver";

/**
 * Free text → planner constraints. The AI path (Gemini, JSON schema) lives in
 * the API route; this file holds the schema it must fill, plus a keyword
 * parser used when the model is unavailable (free-tier quota) so the planner
 * never stops working. Both return the same shape; unknown fields stay null
 * and the form keeps the visitor's own choices for them.
 */

export type ParsedRequest = {
  minutes: number | null;
  companions: Companions | null;
  mobility: Mobility | null;
  interests: Interest[];
  start: Exclude<StartKey, "custom"> | null;
  mode: Mode | null;
};

// Sentinels instead of null ("unknown", 0): structured-output modes are
// stricter about null unions than about enums.
export const PARSE_SCHEMA = {
  type: "object",
  properties: {
    minutes: { type: "integer", description: "Total time available in minutes (e.g. 'ساعتين' → 120). 0 if not said." },
    companions: { type: "string", enum: ["alone", "family", "elderly", "kids", "unknown"], description: "elderly if an older parent or someone who struggles is coming." },
    mobility: { type: "string", enum: ["good", "limited", "unknown"], description: "limited if anyone cannot walk far / has trouble walking." },
    interests: {
      type: "array",
      items: { type: "string", enum: ["mosques", "battles", "wells_gardens"] },
      description: "mosques = historic mosques; battles = Uhud, the Trench; wells_gardens = wells, gardens, palm groves.",
    },
    start: { type: "string", enum: ["nabawi", "quba", "uhud", "unknown"], description: "Where they start or want to stay near." },
    mode: { type: "string", enum: ["walk", "car", "unknown"], description: "Only if they said they walk or have a car/taxi." },
  },
  required: ["minutes", "companions", "mobility", "interests", "start", "mode"],
};

export const PARSE_SYSTEM = `You convert a visitor's request about visiting Seerah sites in Madinah into JSON constraints for a trip planner.
Arabic (any dialect, e.g. Saudi "وش أزور") or English. Fill only what the visitor actually said; use "unknown" (or minutes 0) for anything not stated. Never invent a time or companions.
Examples: "معي ثلاث ساعات بعد العصر ومعي والدتي وتصعب عليها المشي الطويل، ويهمنا مواضع السيرة القريبة من قباء" →
{"minutes":180,"companions":"elderly","mobility":"limited","interests":["mosques","wells_gardens"],"start":"quba","mode":"car"}
"I have 2 hours, I like battle sites" → {"minutes":120,"companions":"unknown","mobility":"unknown","interests":["battles"],"start":"unknown","mode":"unknown"}`;

const AR_DIGITS: Record<string, string> = { "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9" };

/** One spelling for the keyword patterns: Arabic digits, alef/teh-marbuta/yeh variants, diacritics, curly quotes. */
function normalise(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => AR_DIGITS[d] ?? d)
    .replace(/[ً-ْـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[‘’ʼ]/g, "'")
    .toLowerCase();
}

// JS \b doesn't know Arabic letters, so whole words are bounded by "not a
// letter" on both sides, allowing the attached prefixes و ف ب ل and ال.
const PREFIX = "(?:[وفبل]|ال|وال|بال|فال|لل)?";
const word = (alts: string, prefix = PREFIX) => new RegExp(`(?<![\\p{L}\\p{M}])${prefix}(?:${alts})(?![\\p{L}\\p{M}])`, "u");

// "احد" alone is usually "anyone" (ما في احد) or Sunday (الاحد): Uhud only
// with a qualifier, or in Latin script.
const UHUD = /(?:جبل|غزوه|معركه|شهداء|منطقه)\s+احد(?![\p{L}])|سيد الشهداء|جبل الرماه|\buhud\b/u;

// ── Time ────────────────────────────────────────────────────────────────
const HALF = /^\s*(?:و\s*(?:نص|نصف)(?![\p{L}])|and a half\b)/u;
const QUARTER = /^\s*(?:و\s*ربع(?![\p{L}])|and a quarter\b)/u;
const LESS_QUARTER = /^\s*(?:الا|غير)\s*ربع(?![\p{L}])/u;
const PLUS_MINUTES = /^\s*(?:و|and)\s*(\d+)\s*(?:دقيقه|دقايق|دقائق|minutes?|mins?)(?![\p{L}])/u;

const HOUR_WORDS: [RegExp, number][] = [
  [word("ساعتين|ساعتان"), 2],
  [/\b(?:two|2) hours?\b|\bcouple (?:of )?hours\b/, 2],
  [word("(?:ثلاث|ثلاثه|تلات|تلاته) ساعات"), 3],
  [/\bthree hours\b/, 3],
  [word("(?:اربع|اربعه) ساعات"), 4],
  [/\bfour hours\b/, 4],
  [word("(?:خمس|خمسه) ساعات"), 5],
  [/\bfive hours\b/, 5],
  [word("(?:ست|سته) ساعات"), 6],
  [/\bsix hours\b/, 6],
  // A bare "ساعه" is one hour — but never "الساعه ٤" (a clock time).
  [word("ساعه", "(?:[وب])?"), 1],
  [/\b(?:an|one|1) hour\b/, 1],
];

const FRACTIONS: [RegExp, number][] = [
  [word("ثلاث ارباع ساعه"), 45],
  [/\bthree quarters of an hour\b/, 45],
  [word("ربع ساعه"), 15],
  [/\bquarter (?:of an )?hour\b/, 15],
  [word("ثلث ساعه"), 20],
  [word("نص ساعه|نصف ساعه"), 30],
  [/\bhalf (?:an )?hour\b|\bhalf-hour\b/, 30],
];

// "two and a half hours", "1 and a half hours" (English puts the half before "hours").
const EN_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
const EN_AND_A_HALF = /\b(\d+|one|two|three|four|five|six) and a half (?:hours?|hrs?)\b/;

const DAYS: [RegExp, number][] = [
  [word("يوم كامل|طول اليوم|اليوم كله|اليوم كامل"), 360],
  [/\b(?:whole|full|all|entire) day\b/, 360],
  [word("نص يوم|نصف يوم"), 240],
  [/\bhalf (?:a )?day\b/, 240],
];

/** Snap to 5 minutes and keep within what a single outing can be. */
export function normaliseMinutes(m: unknown): number | null {
  if (typeof m !== "number" || !Number.isFinite(m) || m <= 0) return null;
  return Math.min(12 * 60, Math.max(15, Math.round(m / 5) * 5));
}

/** "ساعتين ونص" → 150, "3 hrs" → 180, "ربع ساعه" → 15; clock times ("الساعه ٤") are not durations. */
function readMinutes(text: string): number | null {
  const withSuffix = (hours: number, rest: string) => {
    let h = hours;
    if (HALF.test(rest)) h += 0.5;
    else if (QUARTER.test(rest)) h += 0.25;
    else if (LESS_QUARTER.test(rest)) h -= 0.25;
    const extra = rest.match(PLUS_MINUTES);
    return h * 60 + (extra ? Number(extra[1]) : 0);
  };

  const andAHalf = text.match(EN_AND_A_HALF);
  if (andAHalf) return normaliseMinutes(((EN_NUMBERS[andAHalf[1]] ?? Number(andAHalf[1])) + 0.5) * 60);

  const digits = text.match(/(\d+(?:\.\d+)?)\s*(?:ساعات|ساعه|hours?|hrs?|h)(?![\p{L}])/u);
  if (digits && digits.index !== undefined) {
    return normaliseMinutes(withSuffix(Number(digits[1]), text.slice(digits.index + digits[0].length)));
  }
  for (const [re, m] of FRACTIONS) if (re.test(text)) return m;
  for (const [re, m] of DAYS) if (re.test(text)) return m;
  for (const [re, h] of HOUR_WORDS) {
    const hit = text.match(re);
    if (hit && hit.index !== undefined) return normaliseMinutes(withSuffix(h, text.slice(hit.index + hit[0].length)));
  }
  const mins = text.match(/(\d+)\s*(?:دقيقه|دقايق|دقائق|minutes?|mins?)(?![\p{L}])/u);
  return mins ? normaliseMinutes(Number(mins[1])) : null;
}

// ── Who, how, where ─────────────────────────────────────────────────────
const ELDERLY_AR = word(
  "والدتي|والدي|والده|والدته|الوالده|الوالد|والدين|والديني|امي|ابوي|جدتي|جدي|حبوبتي|كبار السن|كبير السن|كبيره في السن|كبيره بالسن|كبير بالسن|شايب|عجوز|مسن|مسنه|المسنين"
);
const ELDERLY_EN = /\b(?:my (?:mom|mum|mother|dad|father|parents?)|with (?:mom|mum|dad|(?:the |our )?parents)|elderly|grand(?:ma|pa|mother|father|parents?)|old(?:er)? (?:parents?|people|man|woman|lady|relatives?))\b/;
const KIDS_AR = word("اطفال|طفل|طفلي|عيالي|عيال|اولادي|اولاد|بزران|بزارين|ولدي|بنتي|بناتي|صغار");
const KIDS_EN = /\b(?:kids?|children|child|my (?:son|daughter|boys|girls))\b/;
const FAMILY_AR = word("عائله|عايله|عائلتي|عايلتي|اهلي|زوجتي|زوجي|المدام|اسرتي");
const FAMILY_WITH = /(?:مع|و)\s*الاهل(?![\p{L}])/u;
const FAMILY_EN = /\b(?:family|wife|husband|spouse)\b/;
const ALONE_AR = word("لحالي|لوحدي|بروحي|بمفردي|وحدي");
const ALONE_EN = /\b(?:alone|by myself|solo|just me)\b/;

// Walking that can't happen is limited mobility; walking they'd rather not do is just a car trip.
const CANT_WALK = [
  /(?<![\p{L}])(?:ما|لا|مو|مب|ماني|مانيب)\s*(?:عاد\s*|عادت\s*)?[اينت]?(?:قدر|ستطيع)\s*(?:علي\s*)?(?:ال|[اينت])?مشي/u,
  /(?:صعب|يصعب|تصعب|يتعب|تتعب|تعب|ثقيل|ثقل)[^.،,!؟?\n]{0,20}مشي|مشي[^.،,!؟?\n]{0,12}(?:صعب|يتعب|تتعب|متعب|ثقيل)/u,
  word("كرسي متحرك|كرسي|عكاز|عكازه|ركبتها|ركبته|ركبي"),
  /\b(?:can't|cannot|can not|unable to) walk|\b(?:hard|difficult|trouble|struggles?) (?:to walk|walking|with walking)|\bwalking is (?:hard|difficult)|\blimited mobility\b|\bwheelchair\b|\bwalker\b|\bcrutch(?:es)?\b|\bbad knees?\b/,
];
const RATHER_NOT_WALK = [
  /(?<![\p{L}])(?:ما|لا|مو|مب)\s*(?:[اينت]?(?:بي|بغي|حب|ريد)|ودي|ودنا)\s*(?:ال|[اينت])?مشي/u,
  word("بدون مشي|بلا مشي"),
  /\b(?:don't|do not) (?:want|like) to walk|\bno walking\b|\bwithout walking\b/,
];
const WALK = [word("مشي|امشي|نمشي|يمشي|تمشي|مشيا|علي الاقدام|سيرا"), /\bwalk(?:ing)?\b|\bon foot\b/];
const CAR = [
  word("سياره|سيارتي|سيارات|تاكسي|تكسي|اوبر|ليموزين"),
  word("كريم", "(?:[وب])?"), // Careem — but not "الكريم"
  /\b(?:cars?|taxi|cab|uber|careem|driv(?:e|ing))\b/,
];

const START_CUE = /(?:من|عند|قرب|قريب|جنب|ساكن|ساكنين|سكن|فندق|فندقنا|\bnear|\bfrom|\bat|\bstaying)\s*$/u;
const STARTS: [Exclude<StartKey, "custom">, RegExp][] = [
  ["quba", /(?<![\p{L}])(?:[وفبل]|ال)?قباء?(?![\p{L}])|\bquba\b/u],
  ["uhud", UHUD],
  ["nabawi", /(?<![\p{L}])(?:[وفبل])?(?:الحرم|المسجد النبوي|مسجد النبوي|النبوي)(?![\p{L}])|\bprophet's mosque\b|\bharam\b|\bnabawi\b/u],
];

const any = (res: RegExp[], text: string) => res.some((re) => re.test(text));

/** Where they start: the place introduced by "from / near / staying at" wins, else the first one named. */
function readStart(text: string): Exclude<StartKey, "custom"> | null {
  const hits = STARTS.flatMap(([key, re]) => {
    const m = text.match(re);
    return m && m.index !== undefined ? [{ key, index: m.index }] : [];
  }).sort((a, b) => a.index - b.index);
  const cued = hits.find((h) => START_CUE.test(text.slice(Math.max(0, h.index - 16), h.index)));
  return (cued ?? hits[0])?.key ?? null;
}

/** Keyword fallback — deliberately conservative: unknown stays null. */
export function parseRequestFallback(input: string): ParsedRequest {
  const text = normalise(input);

  const elderly = ELDERLY_AR.test(text) || ELDERLY_EN.test(text);
  const kids = KIDS_AR.test(text) || KIDS_EN.test(text);
  const family = FAMILY_AR.test(text) || FAMILY_WITH.test(text) || FAMILY_EN.test(text);
  const alone = ALONE_AR.test(text) || ALONE_EN.test(text);

  const cantWalk = any(CANT_WALK, text);
  const noWalk = cantWalk || any(RATHER_NOT_WALK, text);
  const saysWalk = any(WALK, text) && !noWalk;
  const saysCar = any(CAR, text);

  // A start point is not an interest: "near the Prophet's Mosque" ≠ "I like mosques".
  const forInterests = text
    .replace(/المسجد النبوي|الحرم النبوي|مسجد النبوي|مسجد قباء|prophet's mosque|quba mosque/g, " ")
    .replace(/\bas well\b/g, " ");
  const interests: Interest[] = [];
  if (/مسجد|مساجد|\bmosques?\b|\bmasjids?\b/.test(forInterests)) interests.push("mosques");
  if (/غزو|معرك|معارك|خندق|\bbattles?\b|\btrench\b|\bkhandaq\b|\bghazw/.test(forInterests) || UHUD.test(forInterests)) interests.push("battles");
  if (word("بئر|بير|ابار|ابيار|بستان|بساتين|نخل|نخيل|مزرعه|مزارع").test(forInterests) || /\b(?:wells|the well|a well|well of|gardens?|palms?|orchards?|farms?)\b/.test(forInterests)) {
    interests.push("wells_gardens");
  }
  if (/السيره|\bseerah\b|\bsirah?\b/.test(text) && interests.length === 0) interests.push("mosques", "wells_gardens");

  return {
    minutes: readMinutes(text),
    companions: elderly ? "elderly" : kids ? "kids" : family ? "family" : alone ? "alone" : null,
    mobility: cantWalk ? "limited" : null,
    interests,
    start: readStart(text),
    mode: noWalk ? "car" : saysWalk && saysCar ? null : saysWalk ? "walk" : saysCar ? "car" : null,
  };
}

const COMPANIONS = ["alone", "family", "elderly", "kids"] as const;
const MOBILITY = ["good", "limited"] as const;
const INTERESTS = ["mosques", "battles", "wells_gardens"] as const;
const START = ["nabawi", "quba", "uhud"] as const;
const MODE = ["walk", "car"] as const;
const SENTINEL = "unknown";

const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | null =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : null;

/** Accepts only well-formed values from the model (it can still drift). */
export function sanitizeParsed(raw: Partial<ParsedRequest> | null | undefined): ParsedRequest {
  return {
    minutes: normaliseMinutes(raw?.minutes),
    companions: pick(raw?.companions, COMPANIONS),
    mobility: pick(raw?.mobility, MOBILITY),
    interests: Array.isArray(raw?.interests)
      ? [...new Set(raw.interests.filter((i): i is Interest => (INTERESTS as readonly string[]).includes(i as string)))]
      : [],
    start: pick(raw?.start, START),
    mode: pick(raw?.mode, MODE),
  };
}

/**
 * Fields the model answered in a shape we can't use (missing, wrong type,
 * off-enum). Its explicit "unknown" (or minutes 0) is an answer, not a gap,
 * so only these are filled from the keyword reader.
 */
export function malformedFields(raw: Record<string, unknown> | null | undefined): Set<keyof ParsedRequest> {
  const bad = new Set<keyof ParsedRequest>();
  const ok = (v: unknown, allowed: readonly string[]) => typeof v === "string" && (v === SENTINEL || allowed.includes(v));
  const m = raw?.minutes;
  if (!(typeof m === "number" && Number.isFinite(m) && m >= 0 && m <= 24 * 60)) bad.add("minutes");
  if (!ok(raw?.companions, COMPANIONS)) bad.add("companions");
  if (!ok(raw?.mobility, MOBILITY)) bad.add("mobility");
  if (!ok(raw?.start, START)) bad.add("start");
  if (!ok(raw?.mode, MODE)) bad.add("mode");
  if (!Array.isArray(raw?.interests) || !raw.interests.every((i) => (INTERESTS as readonly string[]).includes(i as string))) bad.add("interests");
  return bad;
}
