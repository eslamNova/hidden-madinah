import type { Tables } from "@/lib/database.types";
import { stripVerify } from "@/lib/content";
import type { Lang } from "@/lib/i18n";
import enContent from "../../content/i18n/en.json";

/**
 * English for database content.
 *
 * Journeys and claims carry their English in the database (drafted with the
 * Arabic, reviewed in /admin). Place and route texts are translated in the
 * repo (content/i18n/en.json, produced by scripts/i18n/) — each entry stores a
 * hash of the Arabic it was translated from, so an edited Arabic text hides
 * its stale English instead of showing an outdated translation.
 *
 * The localizers return the same row shape with the display columns (*_ar)
 * holding the visitor's language, so every component renders English without
 * knowing about locales. Texts with no current English are null (hidden) —
 * except names, which fall back to the Arabic.
 */

export const PLACE_TEXT_FIELDS = [
  "name",
  "summary",
  "story",
  "virtue",
  "visiting_tips",
  "featured_quote",
  "featured_quote_source",
  "how_to_get_there",
  "transport_note",
  "best_time",
  "open_status",
] as const;
export type PlaceTextField = (typeof PLACE_TEXT_FIELDS)[number];

type Entry = { text: string; src: string };
type PlaceEn = {
  fields?: Partial<Record<PlaceTextField, Entry>>;
  transport?: { mode: Entry; note?: Entry | null }[];
  captions?: Record<string, Entry>;
};
type EnContent = { places: Record<string, PlaceEn>; routes: Record<string, { title?: Entry; description?: Entry }> };

const EN = enContent as unknown as EnContent;

/** FNV-1a over the whitespace-normalised text: a cheap "is this still the same Arabic?" check. */
export function sourceHash(text: string): string {
  const s = text.replace(/\s+/g, " ").trim();
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** The English for an Arabic text, or null when missing or translated from a different Arabic. */
function current(entry: Entry | null | undefined, arabic: string | null | undefined): string | null {
  if (!entry?.text || !arabic) return null;
  return entry.src === sourceHash(arabic) ? entry.text : null;
}

type PlaceLike = Partial<Tables<"places">> & { slug: string; media?: Tables<"media">[] };

export function localizePlace<T extends PlaceLike>(row: T, lang: Lang): T {
  if (lang === "ar") return row;
  const en = EN.places[row.slug] ?? {};
  const out: Record<string, unknown> = { ...row };
  for (const f of PLACE_TEXT_FIELDS) {
    const col = `${f}_ar`;
    if (!(col in row)) continue;
    const arabic = f === "name" ? row.name_ar : stripVerify(row[col as keyof T] as string | null);
    const english = current(en.fields?.[f], arabic);
    out[col] = f === "name" ? english ?? row.name_en ?? row.name_ar : english;
  }
  if ("transport_options" in row && Array.isArray(row.transport_options)) {
    const options = row.transport_options as { mode_ar?: string; note_ar?: string; min_sar?: number; max_sar?: number }[];
    out.transport_options = options.flatMap((o, i) => {
      const t = en.transport?.[i];
      const mode = current(t?.mode, o.mode_ar);
      if (!mode) return []; // a fare without a readable mode is no help
      return [{ ...o, mode_ar: mode, note_ar: current(t?.note, o.note_ar) ?? undefined }];
    });
  }
  if (row.media) {
    out.media = row.media.map((m) => ({ ...m, caption_ar: current(en.captions?.[m.id], stripVerify(m.caption_ar)) }));
  }
  return out as T;
}

export function localizeRoute<T extends Partial<Tables<"routes">> & { slug: string }>(row: T, lang: Lang): T {
  if (lang === "ar") return row;
  const en = EN.routes[row.slug] ?? {};
  return {
    ...row,
    ...("title_ar" in row ? { title_ar: current(en.title, row.title_ar) ?? row.title_ar } : {}),
    ...("description_ar" in row ? { description_ar: current(en.description, stripVerify(row.description_ar)) } : {}),
  };
}

/** A claim's text for display: reviewed English on English pages, else null there (hidden). */
export function claimText(c: { text_ar: string; text_en: string | null; en_reviewed: boolean }, lang: Lang): string | null {
  if (lang === "ar") return c.text_ar;
  return c.en_reviewed && c.text_en?.trim() ? c.text_en : null;
}

/** Journey row with its English columns in the display columns (Arabic where no English exists yet). */
export function localizeJourney<T extends Partial<Tables<"journeys">>>(row: T, lang: Lang): T {
  if (lang === "ar") return row;
  return {
    ...row,
    title_ar: row.title_en || row.title_ar,
    subtitle_ar: row.subtitle_en || row.subtitle_ar,
    intro_ar: row.intro_en || row.intro_ar,
    theme_ar: row.theme_en || row.theme_ar,
  };
}

export function localizeStop<T extends Partial<Tables<"journey_stops">>>(row: T, lang: Lang, placeName?: string | null): T {
  if (lang === "ar") return row;
  return {
    ...row,
    title_ar: row.title_en || placeName || row.title_ar,
    script_ar: row.script_en || null,
    human_moment_ar: row.human_moment_en || null,
    reflection_ar: row.reflection_en || null,
    // No English children's version yet: the kids toggle hides itself.
    script_kids_ar: null,
  };
}

export function localizeQuiz<T extends Partial<Tables<"quiz_items">>>(row: T, lang: Lang): T | null {
  if (lang === "ar") return row;
  // A question without a full English option set would be unanswerable.
  if (!row.question_en || !row.options_en || row.options_en.length !== row.options_ar?.length) return null;
  return { ...row, question_ar: row.question_en, options_ar: row.options_en };
}
