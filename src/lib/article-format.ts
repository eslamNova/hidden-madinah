import type { CoverImage } from "@/lib/content";
import type { Json } from "@/lib/database.types";
import { MEDIA_PUBLIC_BASE, variantUrl } from "@/lib/media-spec";

/**
 * Blog article helpers shared by the public pages, the admin editor (client)
 * and its server actions. No database client here: this module is imported
 * by client components.
 */

/** The CHECKs in supabase/migrations/009_articles.sql — the admin form enforces the same limits. */
export const ARTICLE_LIMITS = {
  slug: 120,
  title: 200,
  excerpt: 600,
  body: 100_000,
  coverUrl: 1000,
  author: 120,
  places: 50,
  journeys: 20,
  tags: 20,
  tag: 40,
  sources: 100,
  note: 300,
  /** Wafa al-Wafa runs to 4 volumes (al-'Ilmiyya) or 5 (al-Samarrai); 10 leaves room for typos to be caught, not stored. */
  vol: 10,
  page: 5000,
} as const;

export const ARTICLE_STATUSES = ["draft", "published"] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];
export const isArticleStatus = (s: unknown): s is ArticleStatus => (ARTICLE_STATUSES as readonly unknown[]).includes(s);

/** Lowercase Latin letters and digits in hyphen-separated words (the slug CHECK in 009). */
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Tags with a reviewed label in both languages (messages: blog.tags.*), in chip order. */
export const KNOWN_ARTICLE_TAGS = ["seerah", "hijra", "mosques", "wells", "gardens", "history", "visiting-tips"] as const;

/** A reference to Wafa al-Wafa: printed volume and page, with an optional note. */
export type ArticleSource = { vol: number; page: number; note?: string };

/** The `sources` jsonb column as clean rows; anything malformed is dropped rather than shown. */
export function parseSources(json: Json | null | undefined): ArticleSource[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((s) => {
    if (!s || typeof s !== "object" || Array.isArray(s)) return [];
    const vol = Number(s.vol);
    const page = Number(s.page);
    if (!Number.isInteger(vol) || !Number.isInteger(page) || vol < 1 || page < 1) return [];
    const note = typeof s.note === "string" && s.note.trim() ? s.note.trim() : undefined;
    return [note ? { vol, page, note } : { vol, page }];
  });
}

/**
 * URL slug from a (usually English) title: "Masjid al-Jumu'ah — its story" →
 * "masjid-al-jumuah-its-story". Diacritics in transliteration (Ḥ, ā) fold to
 * plain letters and apostrophes / ʿayn marks disappear rather than split words.
 */
export function slugify(text: string, max = 80): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’‘ʿʾ`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/, "");
}

/** One spelling per tag: admins type them by hand ("Visiting tips ", "visiting-tips"). */
export const normalizeTag = (tag: string) => slugify(tag, ARTICLE_LIMITS.tag);

/** An article has an English version when it has an English title and body (the excerpt is optional). */
export function articleHasEnglish(a: { title_en: string | null; body_en: string | null }): boolean {
  return !!a.title_en?.trim() && !!a.body_en?.trim();
}

/**
 * Plain text from Markdown, for a meta description when the excerpt is empty:
 * images dropped, links reduced to their text, block markers removed.
 */
export function markdownSummary(md: string, max = 160): string {
  const text = md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/gm, "")
    .replace(/[*_~`|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trim()}…`;
}

// ── Cover images ────────────────────────────────────────────────────────────

const VARIANT_RE = /-(?:400|800|1600)\.(?:webp|jpg)$/;

/**
 * An article's cover URL as a CoverImage for PlaceImage / PageHero. Our own
 * media variants (media.mazarat-madinah.com/…-800.webp) keep their responsive
 * srcset; any other https image renders as a bare src. The cover is always
 * shown cropped (object-cover), so the stated size only sets the ratio.
 */
export function articleCover(url: string | null | undefined): CoverImage | null {
  const src = url?.trim();
  if (!src || !/^https:\/\//.test(src)) return null;
  const isVariant = src.startsWith(`${MEDIA_PUBLIC_BASE}/`) && VARIANT_RE.test(src);
  return { url: src, width: 1600, height: 900, singleVariant: !isVariant };
}

/** The image a share preview should use for a cover: the 1600px JPEG of a variant set (Arabic-safe), else the URL itself. */
export function ogImageOf(cover: CoverImage): string {
  return cover.singleVariant ? cover.url : variantUrl(cover.url, 1600).replace(/\.webp$/, ".jpg");
}

// ── Admin input validation (the editor and the server action run the same checks) ──

/** Postgres char_length counts code points; JS .length counts UTF-16 units. */
const chars = (s: string) => [...s].length;

/** What the editor sends: text as typed, sources as typed rows, tags comma-separated. */
export type ArticleInput = {
  id?: string;
  slug: string;
  title_ar: string;
  title_en: string;
  excerpt_ar: string;
  excerpt_en: string;
  body_ar: string;
  body_en: string;
  cover_url: string;
  author: string;
  place_slugs: string[];
  journey_slugs: string[];
  sources: { vol: string; page: string; note: string }[];
  tags: string;
  status: ArticleStatus;
};

/** Message keys under admin.articles.errors. */
export type ArticleErrorCode = "slug" | "title_ar" | "body_ar" | "too_long" | "cover" | "sources" | "tags" | "places";

/** A row ready to save: empty optional texts are null, tags normalised, sources numeric. */
export type CleanArticle = {
  slug: string;
  title_ar: string;
  title_en: string | null;
  excerpt_ar: string | null;
  excerpt_en: string | null;
  body_ar: string;
  body_en: string | null;
  cover_url: string | null;
  author: string | null;
  place_slugs: string[];
  journey_slugs: string[];
  sources: ArticleSource[];
  tags: string[];
  status: ArticleStatus;
};

const str = (v: unknown) => (typeof v === "string" ? v : "");
const strList = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
const orNull = (s: string) => (s.trim() ? s.trim() : null);
/** Markdown keeps its inner whitespace; only the ends are trimmed. */
const body = (s: string) => s.replace(/^\s*\n/, "").trimEnd();

/**
 * Checks an article before saving. Runs in the editor (instant feedback) and
 * again in the server action, which treats its input as untrusted.
 */
export function validateArticle(raw: ArticleInput): { ok: true; value: CleanArticle } | { ok: false; error: ArticleErrorCode } {
  const L = ARTICLE_LIMITS;
  if (!raw || typeof raw !== "object") return { ok: false, error: "slug" };
  const status: ArticleStatus = isArticleStatus(raw.status) ? raw.status : "draft";
  const slug = str(raw.slug).trim();
  if (!SLUG_RE.test(slug) || slug.length > L.slug) return { ok: false, error: "slug" };

  const title_ar = str(raw.title_ar).trim();
  if (!title_ar) return { ok: false, error: "title_ar" };
  const body_ar = body(str(raw.body_ar));
  if (status === "published" && !body_ar.trim()) return { ok: false, error: "body_ar" };
  const body_en = body(str(raw.body_en));

  const value: CleanArticle = {
    slug,
    title_ar,
    title_en: orNull(str(raw.title_en)),
    excerpt_ar: orNull(str(raw.excerpt_ar)),
    excerpt_en: orNull(str(raw.excerpt_en)),
    body_ar,
    body_en: body_en.trim() ? body_en : null,
    cover_url: orNull(str(raw.cover_url)),
    author: orNull(str(raw.author)),
    place_slugs: [...new Set(strList(raw.place_slugs).map((s) => s.trim()).filter(Boolean))],
    journey_slugs: [...new Set(strList(raw.journey_slugs).map((s) => s.trim()).filter(Boolean))],
    sources: [],
    tags: [],
    status,
  };

  const tooLong =
    chars(value.title_ar) > L.title ||
    chars(value.title_en ?? "") > L.title ||
    chars(value.excerpt_ar ?? "") > L.excerpt ||
    chars(value.excerpt_en ?? "") > L.excerpt ||
    chars(value.body_ar) > L.body ||
    chars(value.body_en ?? "") > L.body ||
    chars(value.author ?? "") > L.author;
  if (tooLong) return { ok: false, error: "too_long" };

  if (value.cover_url) {
    let ok = chars(value.cover_url) <= L.coverUrl;
    try {
      ok &&= new URL(value.cover_url).protocol === "https:" && value.cover_url.startsWith("https://");
    } catch {
      ok = false;
    }
    if (!ok) return { ok: false, error: "cover" };
  }

  if (
    value.place_slugs.length > L.places ||
    value.journey_slugs.length > L.journeys ||
    ![...value.place_slugs, ...value.journey_slugs].every((s) => SLUG_RE.test(s) && s.length <= L.slug)
  ) {
    return { ok: false, error: "places" };
  }

  const rows = Array.isArray(raw.sources) ? raw.sources : [];
  for (const row of rows) {
    const vol = str(row?.vol).trim();
    const page = str(row?.page).trim();
    const note = str(row?.note).trim();
    if (!vol && !page && !note) continue; // an empty row is ignored
    const v = Number(vol);
    const p = Number(page);
    if (!/^\d+$/.test(vol) || !/^\d+$/.test(page) || v < 1 || v > L.vol || p < 1 || p > L.page || chars(note) > L.note) {
      return { ok: false, error: "sources" };
    }
    value.sources.push(note ? { vol: v, page: p, note } : { vol: v, page: p });
  }
  if (value.sources.length > L.sources) return { ok: false, error: "sources" };

  const typed = str(raw.tags).split(/[,،]/).map((s) => s.trim()).filter(Boolean);
  const tags = [...new Set(typed.map(normalizeTag))];
  if (tags.length > L.tags || tags.some((tag) => !tag || !SLUG_RE.test(tag))) return { ok: false, error: "tags" };
  value.tags = tags;

  return { ok: true, value };
}
