import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { Lang } from "@/lib/i18n";
import { claimText, localizePlace } from "@/lib/i18n-content";

/**
 * «القصص الإنسانية» — verified claims of kind 'humane', grouped by theme.
 *
 * Cookie-less anon client, as in queries.ts (safe during SSG/ISR). RLS limits
 * anon to verified claims of published places (or of no place), so nothing
 * unreviewed can reach this page.
 */
const publicClient = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

/**
 * Visitors' column grant on claims (migration 008), the same list as
 * PUBLIC_CLAIM_COLUMNS in queries.ts — reviewer_note is internal and never
 * selected. Written out in full so the typed client can parse it.
 */
const STORY_SELECT =
  "id, place_id, topic, text_ar, text_en, en_reviewed, source_id, vol, page, quote_ar, hadith_ref, grading, samarrai_ref, needs_samarrai_check, content_level, kind, themes, status, reviewed_at, created_at, places(slug, name_ar, name_en)";

/** Themes with a label in both languages (messages: stories.themes.*), in tie-break order. */
export const STORY_THEMES = [
  "mercy",
  "humility",
  "brotherhood",
  "loyalty",
  "patience",
  "generosity",
  "courage",
  "worship",
  "forgiveness",
  "neighbourliness",
] as const;
export type StoryTheme = (typeof STORY_THEMES)[number];

const isStoryTheme = (t: string): t is StoryTheme => (STORY_THEMES as readonly string[]).includes(t);

/** Topics that stand in for a place on claims with none (messages: stories.topics.*). */
export const STORY_TOPICS = ["nabawi", "hijra"] as const;
export type StoryTopic = (typeof STORY_TOPICS)[number];

const isStoryTopic = (t: string | null): t is StoryTopic => !!t && (STORY_TOPICS as readonly string[]).includes(t);

/** Lean, client-safe story: only what the page shows. */
export type HumaneStory = {
  id: number;
  /** In the page's language (English only when reviewed). */
  text: string;
  /** Known themes only, so every tag has a label. */
  themes: StoryTheme[];
  vol: number | null;
  page: number | null;
  /** Narration reference as written in the source (Arabic), with its grading. */
  hadithRef: string | null;
  grading: string | null;
  place: { slug: string; name: string } | null;
  /** Shown when the story belongs to a topic rather than a place. */
  topic: StoryTopic | null;
};

export type StoryThemeGroup = { theme: StoryTheme; count: number; ids: number[] };
export type HumaneStories = {
  /** Book order: volume, then page. */
  stories: HumaneStory[];
  /** One group per theme in use, most stories first; a story may sit in several. */
  groups: StoryThemeGroup[];
  /** Verified stories left out because their English is not reviewed yet (always 0 in Arabic). */
  untranslated: number;
};

/** Fresh environments before migration 006 have no claims table: an empty page, not a failed build. */
const isMissingTable = (err: { code?: string; message?: string } | null) =>
  !!err && (err.code === "42P01" || err.code === "PGRST205" || /does not exist|Could not find the table/i.test(err.message ?? ""));

export async function getHumaneStories(lang: Lang = "ar"): Promise<HumaneStories> {
  const { data, error } = await publicClient
    .from("claims")
    .select(STORY_SELECT)
    .eq("status", "verified")
    .eq("kind", "humane")
    .order("vol", { ascending: true, nullsFirst: false })
    .order("page", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true });
  if (isMissingTable(error)) return { stories: [], groups: [], untranslated: 0 };
  if (error) throw error;

  const stories: HumaneStory[] = (data ?? []).flatMap((c) => {
    // English pages show only reviewed English; anything else is dropped.
    const text = claimText(c, lang);
    if (!text) return [];
    const place = c.places ? localizePlace(c.places, lang) : null;
    return [
      {
        id: c.id,
        text,
        themes: [...new Set(c.themes ?? [])].filter(isStoryTheme),
        vol: c.vol,
        page: c.page,
        hadithRef: c.hadith_ref?.trim() || null,
        grading: c.grading?.trim() || null,
        place: place ? { slug: place.slug, name: place.name_ar } : null,
        topic: !place && isStoryTopic(c.topic) ? c.topic : null,
      },
    ];
  });

  const byTheme = new Map<StoryTheme, number[]>();
  for (const s of stories) for (const t of s.themes) byTheme.set(t, [...(byTheme.get(t) ?? []), s.id]);
  const groups = [...byTheme]
    .map(([theme, ids]) => ({ theme, count: ids.length, ids }))
    .sort((a, b) => b.count - a.count || STORY_THEMES.indexOf(a.theme) - STORY_THEMES.indexOf(b.theme));

  return { stories, groups, untranslated: (data ?? []).length - stories.length };
}
