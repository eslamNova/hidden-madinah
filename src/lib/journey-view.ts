import { coverImage, parseTransportOptions, stripVerify, type CoverImage, type TransportOption } from "@/lib/content";
import { PROPHETS_MOSQUE, driveMinutes, haversineKm, walkMinutes, type LatLng } from "@/lib/geo";
import type { Lang } from "@/lib/i18n";
import { claimText } from "@/lib/i18n-content";
import type { ClaimRow, JourneyFull, JourneyRow } from "@/lib/queries";

/**
 * Serializable, language-resolved view of a journey for the client player.
 * Everything that can be computed (legs, access notes) is computed here, on
 * the server, so the player only renders.
 *
 * Input rows come from getJourney(slug, { lang }), which already puts the
 * visitor's language in the display (*_ar) columns; pass the same lang here.
 * Texts are read only from those columns, so nothing is translated twice —
 * the *_en columns are consulted only to know whether English exists.
 */

export type { Lang };

export type StopSource = {
  id: number;
  text: string;
  /** Language of `text`: an English page cites a claim whose English isn't reviewed in its Arabic. */
  textLang: Lang;
  vol: number | null;
  page: number | null;
  samarrai: string | null;
  hadith: string | null;
  grading: string | null;
};

export type PlayerStop = {
  /** Position shown to the visitor (1…n), independent of hidden stops. */
  index: number;
  /** Database sort_order — what the guide API uses to find the stop. */
  order: number;
  title: string;
  placeSlug: string | null;
  cover: CoverImage | null;
  script: string;
  scriptKids: string | null;
  humanMoment: string | null;
  reflection: string | null;
  sources: StopSource[];
  point: LatLng | null;
  next: { title: string; km: number; walkMin: number; driveMin: number } | null;
  hasStairs: boolean | null;
  walkingEffort: string | null;
  visitMin: number | null;
  transport: TransportOption[];
};

export type PlayerQuiz = { question: string; options: string[]; answer: number; explanation: string | null };

export type PlayerJourney = {
  slug: string;
  lang: Lang;
  title: string;
  subtitle: string | null;
  intro: string | null;
  theme: string | null;
  durationMin: number | null;
  mode: string | null;
  cover: CoverImage | null;
  stops: PlayerStop[];
  quiz: PlayerQuiz[];
};

/**
 * Whether a journey can be offered in English: an English title and English
 * narration for every stop the visitor can see. Reads the *_en columns, which
 * rows keep in either language, so Arabic pages can ask too (hreflang).
 */
export function hasEnglishVersion(j: { title_en: string | null; stops: { script_en: string | null }[] }): boolean {
  return !!j.title_en?.trim() && j.stops.length > 0 && j.stops.every((s) => !!s.script_en?.trim());
}

type JourneyTextCols = Pick<JourneyRow, "title_ar" | "subtitle_ar" | "intro_ar" | "theme_ar" | "subtitle_en" | "intro_en" | "theme_en">;

/**
 * The display texts of a localized journey row. Where a journey has no English
 * yet the localized row still holds the Arabic; English pages hide those texts
 * (the title, like a name, falls back).
 */
export function journeyTexts(j: JourneyTextCols, lang: Lang) {
  const en = lang === "en";
  return {
    title: j.title_ar,
    subtitle: en && !j.subtitle_en?.trim() ? null : stripVerify(j.subtitle_ar),
    intro: en && !j.intro_en?.trim() ? null : j.intro_ar || null,
    theme: en && !j.theme_en?.trim() ? null : j.theme_ar || null,
  };
}

export function toPlayerJourney(j: JourneyFull, lang: Lang = "ar"): PlayerJourney {
  /** Language a claim's text_ar is in: unreviewed claims keep their Arabic on English pages. */
  const claimLang = (c: ClaimRow): Lang => (lang === "en" && claimText(c, "en") === null ? "ar" : lang);

  const points: (LatLng | null)[] = j.stops.map((s) => {
    if (s.lat != null && s.lng != null) return { lat: Number(s.lat), lng: Number(s.lng) };
    if (s.place?.lat != null && s.place?.lng != null) return { lat: Number(s.place.lat), lng: Number(s.place.lng) };
    return s.place_id ? null : PROPHETS_MOSQUE;
  });
  const titles = j.stops.map((s) => s.title_ar || s.place?.name_ar || "");

  const stops: PlayerStop[] = j.stops.map((s, i) => {
    const here = points[i];
    const nextPoint = points[i + 1];
    let next: PlayerStop["next"] = null;
    if (i + 1 < j.stops.length) {
      const km = here && nextPoint ? haversineKm(here, nextPoint) : 0;
      next = { title: titles[i + 1], km, walkMin: walkMinutes(km), driveMin: driveMinutes(km) };
    }
    const sources: StopSource[] = (s.claim_ids ?? [])
      .map((id) => j.claims.get(id))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .map((c) => ({
        id: c.id,
        text: c.text_ar,
        textLang: claimLang(c),
        vol: c.vol,
        page: c.page,
        samarrai: c.samarrai_ref,
        hadith: c.hadith_ref,
        grading: c.grading,
      }));
    return {
      index: i + 1,
      order: s.sort_order,
      title: titles[i],
      placeSlug: s.place?.slug ?? null,
      cover: s.place ? coverImage(s.place.media) : null,
      script: s.script_ar || "",
      // Null in English (no English children's version): the toggle hides.
      scriptKids: s.script_kids_ar || null,
      humanMoment: s.human_moment_ar || null,
      reflection: s.reflection_ar || null,
      sources,
      point: here,
      next,
      hasStairs: s.place?.has_stairs ?? null,
      walkingEffort: s.place?.walking_effort ?? null,
      visitMin: s.place?.visit_minutes ?? null,
      transport: s.place ? parseTransportOptions(s.place.transport_options) : [],
    };
  });

  // A quiz explanation only helps in the reader's own language.
  const explanation = (id: number | null) => {
    const c = id != null ? j.claims.get(id) : undefined;
    return c && claimLang(c) === lang ? c.text_ar : null;
  };

  return {
    slug: j.slug,
    lang,
    ...journeyTexts(j, lang),
    durationMin: j.duration_min,
    mode: j.mode,
    cover: stops.find((s) => s.cover)?.cover ?? null,
    stops,
    quiz: j.quiz
      .map((q) => ({
        question: q.question_ar,
        options: q.options_ar ?? [],
        answer: q.answer_index,
        explanation: explanation(q.explanation_claim_id),
      }))
      .filter((q) => q.options.length >= 2),
  };
}
