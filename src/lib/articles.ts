import { createClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/database.types";
import type { Lang } from "@/lib/i18n";
import { articleHasEnglish, normalizeTag, parseSources, type ArticleSource } from "@/lib/article-format";

/**
 * Blog articles («المقالات»), written and published by the owner in
 * /admin/articles (Arabic and English side by side).
 *
 * Cookie-less anon client, as in queries.ts (safe during SSG/ISR). RLS limits
 * anon to status = 'published' (migration 009); every query here also asks for
 * it explicitly, so a draft never reaches a public page.
 *
 * English: an article is readable in English when it has an English title and
 * body. Without them, lists leave it out (it stays one tap away in Arabic) and
 * its /en page says "not in English yet" — the same rule as journeys. English
 * texts never fall back to Arabic, except the title on that notice.
 */
const publicClient = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export type ArticleRow = Tables<"articles">;

/** What lists, feeds and the sitemap need — in the requested language. */
export type ArticleSummary = {
  slug: string;
  /** In the page's language; on an English page without English, the Arabic title (see titleLang). */
  title: string;
  titleLang: Lang;
  excerpt: string | null;
  /** ISO timestamps. */
  publishedAt: string;
  updatedAt: string;
  tags: string[];
  placeSlugs: string[];
  journeySlugs: string[];
  coverUrl: string | null;
  author: string | null;
  hasEnglish: boolean;
};

export type Article = ArticleSummary & {
  /** Markdown in the page's language ("" on an English page without English). */
  body: string;
  sources: ArticleSource[];
  /** Whether the article can be read in the requested language (always true in Arabic). */
  available: boolean;
};

/** Fresh environments before migration 009 have no articles table: an empty blog, not a failed build. */
export const isMissingTable =(err: { code?: string; message?: string } | null) =>
  !!err && (err.code === "42P01" || err.code === "PGRST205" || /does not exist|Could not find the table/i.test(err.message ?? ""));

const clean = (s: string | null | undefined) => s?.trim() || null;

function toSummary(row: ArticleRow, lang: Lang): ArticleSummary {
  const hasEnglish = articleHasEnglish(row);
  const en = lang === "en" && hasEnglish;
  return {
    slug: row.slug,
    title: en ? row.title_en!.trim() : row.title_ar,
    titleLang: en ? "en" : "ar",
    excerpt: lang === "en" ? (en ? clean(row.excerpt_en) : null) : clean(row.excerpt_ar),
    publishedAt: row.published_at ?? row.created_at,
    updatedAt: row.updated_at,
    tags: [...new Set((row.tags ?? []).map(normalizeTag).filter(Boolean))],
    placeSlugs: row.place_slugs ?? [],
    journeySlugs: row.journey_slugs ?? [],
    coverUrl: clean(row.cover_url),
    author: clean(row.author),
    hasEnglish,
  };
}

function toArticle(row: ArticleRow, lang: Lang): Article {
  const summary = toSummary(row, lang);
  const available = lang === "ar" || summary.hasEnglish;
  return {
    ...summary,
    body: lang === "en" ? (available ? row.body_en ?? "" : "") : row.body_ar,
    sources: parseSources(row.sources),
    available,
  };
}

export type ArticleListing = {
  /** Newest first; in English only the articles that have an English version. */
  articles: ArticleSummary[];
  /** Published articles left out because they have no English yet (always 0 in Arabic). */
  arabicOnly: number;
};

export async function getPublishedArticles(lang: Lang = "ar"): Promise<ArticleListing> {
  const { data, error } = await publicClient
    .from("articles")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (isMissingTable(error)) return { articles: [], arabicOnly: 0 };
  if (error) throw error;
  const all = (data ?? []).map((row) => toSummary(row, lang));
  const articles = lang === "en" ? all.filter((a) => a.hasEnglish) : all;
  return { articles, arabicOnly: all.length - articles.length };
}

/** One published article (null when unknown or not published). */
export async function getArticle(slug: string, lang: Lang = "ar"): Promise<Article | null> {
  const { data, error } = await publicClient
    .from("articles")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (isMissingTable(error)) return null;
  if (error) throw error;
  return data ? toArticle(data, lang) : null;
}

export async function getArticleSlugs(): Promise<string[]> {
  const { data, error } = await publicClient.from("articles").select("slug").eq("status", "published");
  if (isMissingTable(error)) return [];
  if (error) throw error;
  return (data ?? []).map((r) => r.slug);
}
