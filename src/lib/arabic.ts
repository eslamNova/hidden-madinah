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
