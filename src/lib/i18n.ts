/**
 * Two languages: Arabic at the site root (unchanged URLs) and English under
 * /en. Each language has its own root layout (src/app/(ar), src/app/(en)), so
 * <html lang dir> is right from the first byte and pages stay static.
 */
export type Lang = "ar" | "en";

/** next-intl locale string → Lang ("ar-u-nu-latn" pins Latin digits for Arabic). */
export const langOf = (locale: string | null | undefined): Lang => (locale?.startsWith("en") ? "en" : "ar");

export const INTL_LOCALE: Record<Lang, string> = { ar: "ar-u-nu-latn", en: "en" };

/** Public paths that have an English twin under /en (admin and API never do). */
const HAS_EN = /^\/(?:$|places(?:\/|$)|journeys(?:\/|$)|stories\/?$|plan\/?$|my-journey\/?$|map\/?$|routes(?:\/|$)|tour\/?$|privacy\/?$)/;

const splitHref = (href: string): [string, string] => {
  const i = href.search(/[?#]/);
  return i === -1 ? [href, ""] : [href.slice(0, i), href.slice(i)];
};

/** "/en/places/x" → "/places/x"; Arabic paths are returned as they are. */
export function stripLang(pathname: string): string {
  if (pathname === "/en") return "/";
  return pathname.startsWith("/en/") ? pathname.slice(3) : pathname;
}

/** An internal href in the given language: "/plan" → "/en/plan" for English. */
export function localizeHref(href: string, lang: Lang): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const [path, rest] = splitHref(href);
  const bare = stripLang(path);
  if (lang === "ar" || !HAS_EN.test(bare)) return bare + rest;
  return (bare === "/" ? "/en" : `/en${bare}`) + rest;
}

/** Whether a page has a twin in the other language (for the language switch). */
export const hasEnglish = (pathname: string) => HAS_EN.test(stripLang(pathname));

/** hreflang alternates for a page's metadata. */
export function languageAlternates(arPath: string, lang: Lang) {
  return {
    canonical: localizeHref(arPath, lang),
    languages: { ar: arPath, en: localizeHref(arPath, "en"), "x-default": arPath },
  };
}
