import type { Lang } from "@/lib/i18n";

const TASHKEEL_RE = /[ً-ٰٟ]/g;
const TATWEEL_RE = /ـ/g;

/**
 * Normalize Arabic text for search matching: strip tashkeel and tatweel,
 * unify hamza forms (أ/إ/آ → ا), taa marbuta (ة → ه), and alef maqsura (ى → ي).
 */
export function normalizeArabic(text: string): string {
  return text
    .replace(TASHKEEL_RE, "")
    .replace(TATWEEL_RE, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .trim()
    .toLowerCase();
}

/** Case/diacritic-insensitive containment test for Arabic search boxes. */
export function arabicIncludes(haystack: string, needle: string): boolean {
  return normalizeArabic(haystack).includes(normalizeArabic(needle));
}

// Latin letters that carry accents (Latin-1 Supplement → Latin Extended
// Additional): only these are decomposed, so Arabic letters never pass
// through NFD (which would split أ/ؤ/ئ into base + hamza).
const ACCENTED_LATIN_RE = /[\u00C0-\u024F\u1E00-\u1EFF]/g;
const COMBINING_RE = /[\u0300-\u036F]/g;
// Transliteration marks, apostrophes, hyphens and spaces: "Masjid al-Qiblatayn",
// "Qubāʾ" and "qiblatayn" should all find each other.
const LATIN_NOISE_RE = /[\s\u02BB\u02BC\u02BE\u02BF'\u2018\u2019`\u00B4\-\u2010\u2013\u2014.]/g;

/**
 * Normalize transliterated/English text for search: drops accents
 * (ā → a, ḥ → h), transliteration marks, hyphens and spaces, lowercases.
 */
export function normalizeLatin(text: string): string {
  return text
    .replace(ACCENTED_LATIN_RE, (ch) => ch.normalize("NFD").replace(COMBINING_RE, ""))
    .replace(LATIN_NOISE_RE, "")
    .toLowerCase();
}

/**
 * Search-box matching in the page's language. Arabic pages keep the exact
 * Arabic matching above; English pages also fold Latin accents and
 * transliteration marks (and still match Arabic text, e.g. names that have
 * no English yet).
 */
export function searchIncludes(haystack: string, needle: string, lang: Lang): boolean {
  if (lang === "ar") return arabicIncludes(haystack, needle);
  const norm = (s: string) => normalizeLatin(normalizeArabic(s));
  return norm(haystack).includes(norm(needle));
}
