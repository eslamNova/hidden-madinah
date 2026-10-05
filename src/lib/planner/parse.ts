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
const NUM_WORDS: [RegExp, number][] = [
  [/ساعتين|ساعتان|two hours|2 hours/, 120],
  [/ثلاث ساعات|ثلاثة ساعات|3 ساعات|three hours/, 180],
  [/أربع ساعات|اربع ساعات|4 ساعات|four hours/, 240],
  [/نص ساعة|نصف ساعة|half an hour|30 دقيقة/, 30],
  [/ساعة ونص|ساعة ونصف|ساعه ونص|hour and a half|1\.5 hours/, 90],
  [/ساعة|ساعه|an hour|one hour|1 hour/, 60],
  [/يوم كامل|طول اليوم|whole day|full day/, 360],
];

/** Keyword fallback — deliberately conservative. */
export function parseRequestFallback(input: string): ParsedRequest {
  const text = input.replace(/[٠-٩]/g, (d) => AR_DIGITS[d] ?? d).toLowerCase();
  let minutes: number | null = null;
  const explicit = text.match(/(\d+(?:\.\d+)?)\s*(ساعات|ساعة|hours?|h\b)/);
  if (explicit) minutes = Math.round(Number(explicit[1]) * 60);
  else {
    const mins = text.match(/(\d+)\s*(دقيقة|دقائق|minutes?|mins?)/);
    if (mins) minutes = Number(mins[1]);
    else for (const [re, m] of NUM_WORDS) if (re.test(text)) { minutes = m; break; }
  }

  const elderly = /والدتي|والدي|امي|أمي|ابوي|أبوي|جدتي|جدي|كبار السن|كبير السن|كبيرة في السن|my mother|my father|parents|elderly|grand(ma|pa|mother|father)/.test(text);
  const kids = /أطفال|اطفال|عيالي|أولادي|اولادي|بزران|kids|children/.test(text);
  const family = /عائلة|العائلة|أهلي|اهلي|زوجتي|family|wife|husband/.test(text);
  const limited =
    elderly ||
    /ما يقدر يمشي|ما تقدر تمشي|صعب عليها المشي|يصعب عليه|تصعب عليها|كرسي|عربية|عكاز|can.?t walk|cannot walk|wheelchair|limited mobility|walking is hard/.test(text);

  // A start point is not an interest: "near the Prophet's Mosque" ≠ "I like mosques".
  const forInterests = text.replace(/المسجد النبوي|الحرم النبوي|مسجد قباء|prophet'?s mosque|quba mosque/g, " ");
  const interests: Interest[] = [];
  if (/مسجد|مساجد|mosque/.test(forInterests)) interests.push("mosques");
  if (/غزو|معرك|أحد|احد|الخندق|خندق|battle|uhud|trench/.test(forInterests)) interests.push("battles");
  if (/بئر|آبار|ابار|بستان|بساتين|نخل|well|garden|palm/.test(forInterests)) interests.push("wells_gardens");
  if (/السيرة|seerah/.test(text) && interests.length === 0) interests.push("mosques", "wells_gardens");

  const start = /قباء|quba/.test(text) ? "quba" : /أحد|احد|uhud/.test(text) ? "uhud" : /الحرم|المسجد النبوي|prophet'?s mosque|haram/.test(text) ? "nabawi" : null;
  const mode = /مشي|امشي|أمشي|نمشي|على الأقدام|walk|on foot/.test(text) && !limited ? "walk" : /سيارة|سيارتي|تاكسي|أوبر|اوبر|كريم|car|taxi|uber/.test(text) || limited ? "car" : null;

  return {
    minutes,
    companions: elderly ? "elderly" : kids ? "kids" : family ? "family" : null,
    mobility: limited ? "limited" : null,
    interests,
    start,
    mode,
  };
}

/** Accepts only well-formed values from the model (it can still drift). */
export function sanitizeParsed(raw: Partial<ParsedRequest> | null | undefined): ParsedRequest {
  const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | null =>
    typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : null;
  const minutes = typeof raw?.minutes === "number" && raw.minutes > 0 && raw.minutes <= 24 * 60 ? Math.round(raw.minutes) : null;
  return {
    minutes,
    companions: pick(raw?.companions, ["alone", "family", "elderly", "kids"] as const),
    mobility: pick(raw?.mobility, ["good", "limited"] as const),
    interests: Array.isArray(raw?.interests)
      ? [...new Set(raw.interests.filter((i): i is Interest => ["mosques", "battles", "wells_gardens"].includes(i as string)))]
      : [],
    start: pick(raw?.start, ["nabawi", "quba", "uhud"] as const),
    mode: pick(raw?.mode, ["walk", "car"] as const),
  };
}
